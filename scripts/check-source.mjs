import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
for(const file of files){
 if(!/\.(ts|tsx|js|mjs|json|yml|sql)$/.test(file)||file.endsWith('package-lock.json'))continue;
 const content=readFileSync(file,'utf8');
 if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(content))throw Error(`Potential secret in ${file}`);
}
console.log('Source secret-pattern check passed (not a complete security audit).');
