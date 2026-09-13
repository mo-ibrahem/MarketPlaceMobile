const fs = require('node:fs');
const path = require('node:path');
const names = new Set(Object.keys(process.env));
for (const filename of fs.readdirSync(process.cwd()).filter(name => /^\.env(?:\..+)?$/.test(name))) {
  const file = path.join(process.cwd(), filename);
  if (!fs.statSync(file).isFile()) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(EXPO_PUBLIC_[A-Z0-9_]+)\s*=/);
    if (match) names.add(match[1]);
  }
}
const forbidden = [...names].filter(name => name.startsWith('EXPO_PUBLIC_') &&
  /SECRET|CERT|PRIVATE|SERVICE_ROLE|PAYMOB_API_KEY|PASSWORD/.test(name));
if (forbidden.length) {
  console.error('Private credentials must not use public Expo variables: ' + forbidden.join(', '));
  process.exitCode = 1;
} else {
  console.log('No private credential variable names exposed through EXPO_PUBLIC_.');
}
