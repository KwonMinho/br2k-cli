#!/usr/bin/env node

const program = require('commander');
const chalk = require('chalk');

const containerCommand = require('../lib/container.js');
const configCommand = require('../lib/config.js');
const k8sCommand = require('../lib/kubernetes');
const registryCommand = require('../lib/serviceRegistry');
//const serviceRegistry = require('../lib/serviceRegistry');



program.command(chalk.greenBright('[config-command]')) 
program
    .command('init') 
    .description('Create a br2k project in current location')
    .action((args)=> {
        configCommand("init", "init");
    });
program
    .command('ask-context') 
    .option('-r, --remote [remote server]', chalk.redBright('[required] ') +'The path to the Kubernetes context file')
    .option('-f, --file [context name]', chalk.redBright('[required] ')+'The path to the Kubernetes context ask document')
    .description('ask context to context-assign-server(k8s-manager)')
    .action((args)=> {
        configCommand("ask-context", args);
    });
program
    .command('set-context') 
    .option('-f, --file [file path]', chalk.redBright('[required] ') +'The path to the Kubernetes context file')
    .option('-n, --contextname [context name]', 'The path to the Kubernetes context file')
    .description('add Kubernetes information for deploying apps in this project')
    .action((args)=> {
        configCommand("context", args);
    });
program
    .command('add-image-registry') 
    .option('-f, --file [file path]', chalk.redBright('[required] ') +'The file path to container-registry info for access')
    .description('add container registry info for access in current context')
    .action((args)=> {
        configCommand("add-image-registry", args);
    });
program
    .command('add-service-registry') 
    .option('-f, --file [file path]', chalk.redBright('[required] ') +'The path to the Kubernetes context file')
    .description('add service registry info for access in current context')
    .action((args)=> {
        configCommand("add-service-registry", args);
    });
program.command('             ') 

/**
 * k8s config command
*/
program.command(chalk.greenBright('[context-command]')) 
program
    .command('cur-context') 
    .description('print the context used in this project')
    .option('-s, --secrets', 'print available secrets in current context')
    // .option('-e, --endpoints', 'print endpoints info in current context')
    .option('-r, --registered', 'Print the service ID and the account used registered in service registry [current context]')
    .action((args)=> {
        configCommand("current", args);
    });
program
    .command('change-context') 
    .option('-t, --target [context name]', chalk.redBright('[required] ') +'Print taget context')
    .description('change the context used by this project')
    .action((args)=> {
        configCommand("change", args);
    });
program
    .command('change-k8s-server') 
    .option('-i, --index [index of api-server at context]', chalk.redBright('[required] ') +'Print taget context')
    .description('change api-server of k8s to connect at current context')
    .action((args)=> {
        configCommand("change-k8s-server", args);
    });
program
    .command('list-context') 
    .option('-t, --target [context name]', 'Print taget context')
    .option('-d, --detail', 'Print detail of contexts')
    .description('print the context used in this project')
    .action((args)=> {
        configCommand("list", args);
    });
program
    .command('rm-context') 
    .option('-t, --target [context name]', 'taget context')
    .description('remove target context in this project')
    .action((args)=> {
        configCommand("rmc", args);
    });
program.command('             ') 


/**
 * container & registry command
*/

program.command(chalk.greenBright('[image/contianer-registry]'))
program
    .command('build') 
    .description('build an image from a Dockerfile') 
    .option('-n, --imagename [name]', 'image name')
    .action((args)=>{
       containerCommand("build", args);
    });

program
    .command('list') 
    .description('displays the image built in this project') 
    .action(function () {
        containerCommand("list", "");
    });

program
    .command('push')
    .option('-i, --image [image name, image id]', chalk.redBright('[required] ') + 'images to push in this project')
    .option('-p, --project [project]', chalk.redBright('[required] ') + 'container registry project to push')
    .description('push the image to the container registry')
    .action((args)=> {
        containerCommand("push", args);
    });

program
    .command('rmi') 
    .description('delete the image built in this project')
    .option('-i, --id [id]', 'image ID')
    .option('--allimage', 'Delete all images built in this project')
    .option('-f, --force', 'Force removal of the image')
    .action((args)=>{
        containerCommand("rmi", args);
    });

program
    .command('set-secret') 
    .option('-p, --password [registry password]', chalk.redBright('[required] ')+'password of container registry')
    .option('-n, --secretname [secret name]', 'name of credential')
    .description('create credential of container registry in the current context of kubernetess')
    .action((args)=> {
        k8sCommand("secret", args);
    });
program
    .command('rm-secret') 
    .option('-s, --secretname [secret name]', 'secret name to delete')
    .option('--allsecret', 'delete all secret created in current context')
    .description('remove secrets in current context of kubernetes')
    .action((args)=> {
        k8sCommand("rms", args);
    });

program
    .command('login-registry') 
    .option('-r, --remote [url]', chalk.redBright('[required] ') + 'docker registry uri')
    .option('-u, --user [id]', chalk.redBright('[required] ')+ 'id of docker registry')
    .option('-p, --password [password]', chalk.redBright('[required] ')+ 'password of docker registry')
    .option('-c, --connect ', 'Show the recently connected container registry from this project')
    .description('connect to the container registry to store the images')
    .action((args)=> {
        containerCommand("registry", args);
    });

program
    .command('logout-registry') 
    .description('disconnect the container registry currently in use.')
    .action(()=> {
        containerCommand("registry-out");
    });

program.command('             ') 


/**
 * service regsitry command
*/
program.command(chalk.greenBright('[service-registry]'))
program
    .command('register') 
    .option('-f, --file [file path]', chalk.redBright('[required] ') +'the path to the Service file')
    .option('-p, --password [password]', chalk.redBright('[required] ') +'register account password')
    .description('register service info in blockchain service registry')
    .action((args)=> {
        registryCommand("register", args);
    });
program
    .command('view-service') 
    .option('-i, --serviceid [id]', 'service ID registered in service registry')
    .option('-f, --file [filePath, fileType: json]', 'file path to save imported service info')
    .description('view service information registered in service registry')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        registryCommand("view", args);
    });
program.command('             ') 


/**
 * k8s command
*/
program.command(chalk.greenBright('[kubernetes]')) 
program
    .command('test') 
    .option('-i, --image [image]', chalk.redBright('[required:main] ')+'image to use in deployment testing')
    .option('-s, --secret [secret name]', 'container registry credentials in the current context k8s namespace')
    .option('-e, --end', 'end the deployment test on the current context')
    .description('run deployment test on current context')
    .action((args)=> {
        k8sCommand("test", args);
    });


program
    .command('spray') 
    .option('-i, --image [image]', chalk.redBright('[required:main] ')+'image to use in deployment')
    .option('-r, --replicas [replicas]', chalk.redBright('[required:main] ')+'number of services to replicate')
    .option('-s, --secret [secret]', 'secret used to download images')
    .option('-m, --mount [path]', 'service container mount')
    .option('-a, --add [path]', 'yaml file path of add container')
    .description('run deployment on current context')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        await k8sCommand("spray", args);
        registryCommand("spray", args);
    });
program
    .command('state') 
    .description('print app status currently deployed in the context of this project')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        await k8sCommand("state", args);
        return;
    });
program
    .command('recovery') 
    .description('redeploy replicas apps that are stopped in the currently service')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        await k8sCommand("recovery", args);
    });
program
    .command('add') 
    .option('-r, --replicas [replicas]', chalk.redBright('[required:main] ')+'number of replicas to add')
    .description('add replicas apps in the currently service')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        await k8sCommand("add", args);
        registryCommand("updateReplicas", args);
    });
program
    .command('reduce') 
    .option('-r, --replicas [replicas]', chalk.redBright('[required:main] ')+'number of replicas to reduce')
    .description('reduce replicas apps in the currently service')
    .action(async (args)=> {
        await registryCommand("syncReplicas", args);
        await k8sCommand("reduce", args);
        registryCommand("updateReplicas", args);
    });
program
    .command('pause') 
    .description('pause deployed app in the context of this project')
    .action(async (args)=> {
        await registryCommand("pause", args);
        k8sCommand("pause", args);
    });
program.command('             ') 


program.version('0.0.2', '-v, --version', 'output the current version');
program.parse(process.argv);
