#define _GNU_SOURCE
#include <dlfcn.h>
#include <unistd.h>
#include <time.h>
ssize_t read(int fd, void *buf, size_t n) {
 static ssize_t (*next)(int,void*,size_t); static int counter;
 if(!next) next=dlsym(RTLD_NEXT,"read");
 if(n==24 && ++counter==6) {struct timespec t={3,100000000}; nanosleep(&t,0);}
 return next(fd,buf,n);
}
