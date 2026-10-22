import {spawn} from 'node:child_process';import {existsSync} from 'node:fs';
const binary=process.env.GODOT||(existsSync('/Applications/Godot.app/Contents/MacOS/Godot')?'/Applications/Godot.app/Contents/MacOS/Godot':'godot');
const child=spawn(binary,['--path','godot',...process.argv.slice(2)],{stdio:'inherit'});child.on('error',e=>{console.error(`Godot 4.7 is required: ${e.message}. Set GODOT to its executable.`);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
