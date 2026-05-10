import { readFileSync } from 'fs';
const lines = readFileSync('.next/server/app/page.js', 'utf8').split('\n');
console.log('--- LINE 122 ---');
console.log(lines[121].substring(0, 100)); // Just the first chars
console.log('--- LINE 123 ---');
console.log(lines[122]);
console.log('--- LINE 124 ---');
console.log(lines[123]);
