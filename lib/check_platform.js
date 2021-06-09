/**
 * Check for truffle framework
 */


/*main*/
module.exports = function(shell, platform){
  if (!shell.which(platform)) {
    shell.echo('This requires a '+platform+' platform.');
    shell.exit(1);
  }
}

