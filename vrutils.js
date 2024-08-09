#!/usr/bin/env node
const { OptionBuilder } = require("./OptionBuilder.js");
// const inputArgs = process.argv.slice(2).map((arg) => arg.toLowerCase());
const inputArgs = process.argv.slice(2);

const command = inputArgs.at(0);

const options = new OptionBuilder(inputArgs.slice(1));

const { help } = require("./commands/help.js");

const runner = require(`./commands/${command}.js`)[command];

if(!runner) {
  console.log(
    `비어있거나 지원하지 않는 커맨드입니다. 입력한 커맨드 : [${inputArgs.join(
      ", "
    )}]`
  );
  help(options);
}

runner(options);