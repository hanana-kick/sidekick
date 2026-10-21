#define _GNU_SOURCE
#include <sys/syscall.h>
#include <unistd.h>
/* Test only: replace a nominal child exit with failure, after its CPU burn. */
void _exit(int status) { syscall(SYS_exit_group, status == 0 ? 23 : status); __builtin_unreachable(); }
