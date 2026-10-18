import {execFileSync} from 'node:child_process';
execFileSync(process.env.CC??'cc',['-O2','native-grid.c','-ldl','-o','native-grid'],{stdio:'inherit'});
