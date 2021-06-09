/**
 * Check for project config(.br2k.json)
 */

const fs = require('fs');
const path = './.br2k.json'
const chalk = require('chalk');
const { exit } = require('process');


/*main*/
module.exports = function(){
  try{
    if(!fs.existsSync(path)){
      console.log(chalk.greenBright("There are no configuration files in this project => .br2k.json "));
      exit(1);
    }
  }catch(err){
    console.error(err);
  }
  return JSON.parse(fs.readFileSync(path,'utf8'));
}

