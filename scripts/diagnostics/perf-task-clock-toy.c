#define _GNU_SOURCE
#include <linux/perf_event.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <unistd.h>
#include <stdint.h>
#include <stdio.h>
#include <errno.h>
#include <string.h>
#include <time.h>
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>

struct reading { uint64_t value, enabled, running; };
static int fd;
static const char *stage="startup";
static void fail(const char *reason){fprintf(stderr,"{\"stage\":\"%s\",\"success\":false,\"reason\":\"%s\",\"errno\":%d}\n",stage,reason,errno);exit(2);}
static void exact(int f,void *p,size_t n,int writing){size_t done=0;while(done<n){ssize_t k=writing?write(f,(char*)p+done,n-done):read(f,(char*)p+done,n-done);if(k<0&&errno==EINTR)continue;if(k<=0)fail("barrier-short-or-failed");done+=(size_t)k;}}
static void sendbyte(int f){char c='r';exact(f,&c,1,1);}
static void recvbyte(int f){char c=0;exact(f,&c,1,0);if(c!='r')fail("bad-barrier-marker");}
static void waited(pid_t p){int status;pid_t r;do{r=waitpid(p,&status,0);}while(r<0&&errno==EINTR);if(r!=p||!WIFEXITED(status)||WEXITSTATUS(status))fail("child-not-normal-success");}
static void livechild(pid_t p){siginfo_t info={0};if(waitid(P_PID,p,&info,WEXITED|WNOHANG|WNOWAIT)||info.si_pid)fail("expected-live-child-exited");}

static uint64_t wallns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t))fail("monotonic-clock-failed");return (uint64_t)t.tv_sec*1000000000ULL+t.tv_nsec;}
static void child_deadline(void){signal(SIGALRM,SIG_DFL);alarm(3);}
static struct reading snapshot(const char *phase) {
 stage=phase;struct reading r;uint64_t start=wallns();
 if (read(fd, &r, sizeof r) != sizeof r) {perror("read task-clock; stopping");exit(2);}
 uint64_t finish=wallns();if(finish-start>100000000ULL)fail("counter-read-exceeded-100ms");
 printf("{\"phase\":\"%s\",\"taskClockNs\":%llu,\"enabled\":%llu,\"running\":%llu,\"readStartNs\":%llu,\"readEndNs\":%llu}\n",phase,(unsigned long long)r.value,(unsigned long long)r.enabled,(unsigned long long)r.running,(unsigned long long)start,(unsigned long long)finish);
 fflush(stdout);if(r.enabled!=r.running){fprintf(stderr,"Counter scheduling incomplete; no scaling fallback\n");exit(9);}return r;
}
static double nowcpu(void) {struct timespec t;if(clock_gettime(CLOCK_THREAD_CPUTIME_ID,&t))fail("thread-clock-failed");return t.tv_sec+t.tv_nsec*1e-9;}
static void burn(void) {double start=nowcpu();while(nowcpu()-start<.05){(void)syscall(SYS_getpid);}}
static void *threadwork(void *arg) {(void)arg;burn();return NULL;}
int main(int argc,char **argv) {
 if(argc==2&&!strcmp(argv[1],"--owned-exec-child")){burn();return 0;}
 alarm(5);
 struct perf_event_attr a={0};a.size=sizeof a;a.type=PERF_TYPE_SOFTWARE;a.config=PERF_COUNT_SW_TASK_CLOCK;
 a.inherit=1;a.exclude_kernel=1;a.exclude_hv=1;
 a.read_format=PERF_FORMAT_TOTAL_TIME_ENABLED|PERF_FORMAT_TOTAL_TIME_RUNNING;
 // Own calling thread only, before it creates any child/thread. No attach,
 // system-wide monitoring, sample buffers, privilege change or fallback flags.
 fd=syscall(SYS_perf_event_open,&a,0,-1,-1,PERF_FLAG_FD_CLOEXEC);
 if(fd<0){int e=errno;printf("{\"stage\":\"self-task-clock-open\",\"success\":false,\"errno\":%d,\"reason\":\"%s\",\"inherit\":true,\"excludeKernel\":true,\"excludeHv\":true,\"fallbackAttempted\":false}\n",e,strerror(e));return 77;}
 puts("{\"stage\":\"self-task-clock-open\",\"success\":true,\"inherit\":true,\"excludeKernel\":true,\"excludeHv\":true,\"scope\":\"owned synthetic tree only; not browser CPU proof\"}");
 struct reading start=snapshot("initial");struct rusage ru0,ru1;if(getrusage(RUSAGE_SELF,&ru0))fail("getrusage-before");burn();if(getrusage(RUSAGE_SELF,&ru1))fail("getrusage-after");struct reading self=snapshot("after-self");
 long user_us=(ru1.ru_utime.tv_sec-ru0.ru_utime.tv_sec)*1000000+ru1.ru_utime.tv_usec-ru0.ru_utime.tv_usec;
 long system_us=(ru1.ru_stime.tv_sec-ru0.ru_stime.tv_sec)*1000000+ru1.ru_stime.tv_usec-ru0.ru_stime.tv_usec;
 printf("{\"phase\":\"self-user-system-crosscheck\",\"userUs\":%ld,\"systemUs\":%ld,\"taskClockDeltaNs\":%llu}\n",user_us,system_us,(unsigned long long)(self.value-start.value));
 pthread_t thread;if(pthread_create(&thread,NULL,threadwork,NULL)){return 3;}if(pthread_join(thread,NULL))fail("thread-join-failed");struct reading threads=snapshot("after-thread-exit");
 pid_t child=fork();if(child<0)return 4;if(child==0){child_deadline();burn();_exit(0);}waited(child);struct reading children=snapshot("after-fork-reaped");
 int autoReady[2];if(pipe(autoReady))fail("pipe");signal(SIGCHLD,SIG_IGN);child=fork();if(child<0)return 4;if(child==0){child_deadline();burn();sendbyte(autoReady[1]);_exit(0);}recvbyte(autoReady[0]);errno=0;pid_t ar;do{ar=waitpid(child,NULL,0);}while(ar<0&&errno==EINTR);if(ar!=-1||errno!=ECHILD)fail("auto-reap-not-confirmed");close(autoReady[0]);close(autoReady[1]);struct reading automatic=snapshot("after-auto-reaped");
 signal(SIGCHLD,SIG_DFL);
 // Subreaper only provides deterministic cleanup of our own orphan toy, not CPU accounting.
 if(prctl(PR_SET_CHILD_SUBREAPER,1,0,0,0))return 6;
 int ready[2],release[2];if(pipe(ready)||pipe(release))return 7;
 child=fork();if(child<0)return 4;
 if(child==0){child_deadline();pid_t grandchild=fork();if(grandchild<0)_exit(4);if(grandchild==0){child_deadline();burn();pid_t me=getpid();exact(ready[1],&me,sizeof me,1);recvbyte(release[0]);_exit(0);}_exit(0);}
 waited(child);pid_t orphan;exact(ready[0],&orphan,sizeof orphan,0);livechild(orphan);
 struct reading live=snapshot("live-reparented-grandchild");livechild(orphan);sendbyte(release[1]);waited(orphan);
 struct reading reparented=snapshot("after-reparented-grandchild-exit");
 child=fork();if(child<0)return 4;if(child==0){child_deadline();execl(argv[0],argv[0],"--owned-exec-child",NULL);_exit(8);}waited(child);
 struct reading executed=snapshot("after-exec-child-exit");
 int ready2[2],release2[2];if(pipe(ready2)||pipe(release2))return 7;
 pid_t concurrent[2];for(int i=0;i<2;i++){concurrent[i]=fork();if(concurrent[i]<0)return 4;if(concurrent[i]==0){child_deadline();burn();sendbyte(ready2[1]);recvbyte(release2[0]);_exit(0);}}
 recvbyte(ready2[0]);recvbyte(ready2[0]);for(int i=0;i<2;i++)livechild(concurrent[i]);struct reading parallel=snapshot("two-live-concurrent-children");for(int i=0;i<2;i++)livechild(concurrent[i]);
 sendbyte(release2[1]);sendbyte(release2[1]);for(int i=0;i<2;i++)waited(concurrent[i]);struct reading closed=snapshot("after-concurrent-children-exit");
 for(int i=0;i<4;i++){if(pthread_create(&thread,NULL,threadwork,NULL))return 3;if(pthread_join(thread,NULL))fail("thread-join-failed");}struct reading churn=snapshot("after-four-thread-churn");
 errno=0;pid_t leftover=waitpid(-1,NULL,WNOHANG);if(leftover!=-1||errno!=ECHILD)return 10;
 puts("{\"phase\":\"shutdown\",\"allOwnedChildrenReaped\":true}");
 close(fd);
 // Broad diagnostic bounds only: count must include substantial work from each
 // owned stage. No calibration or retry if an inheritance check fails.
 uint64_t deltas[]={self.value-start.value,threads.value-self.value,children.value-threads.value,automatic.value-children.value,live.value-automatic.value,executed.value-reparented.value};
 for(unsigned i=0;i<sizeof deltas/sizeof deltas[0];i++)if(deltas[i]>75000000)return 11;
 if(reparented.value-live.value>10000000||closed.value-parallel.value>10000000||parallel.value-executed.value>150000000||churn.value-closed.value>300000000)return 11;
 uint64_t observed=self.value-start.value,reference=(uint64_t)(user_us+system_us)*1000;
 if(observed>reference+5000000||reference>observed+5000000)return 12;
 if(self.value-start.value<40000000||threads.value-self.value<40000000||children.value-threads.value<40000000||automatic.value-children.value<40000000||live.value-automatic.value<40000000||reparented.value<live.value||executed.value-reparented.value<40000000||parallel.value-executed.value<80000000||closed.value<parallel.value||churn.value-closed.value<160000000||system_us<10000)return 5;
 puts("{\"stage\":\"complete\",\"success\":true,\"autoReapExitStatusAvailable\":false}");return 0;
}
