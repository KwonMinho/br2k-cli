/**
 * About container command file
 */

const IMAGES_LIST_PATH = '/util/docker/images.json';
const REGISTRY_PATH = '/util/docker/registry.json';
const CONTEXTS_FILE = '/util/k8s/contexts.json';


const SHELL_SUCCESS = 0;

const fs = require('fs');
const randomWord = require('random-word');
const shell = require('shelljs');
const { printTable } = require('console-table-printer');
const check_plafform = require('./check_platform');
const check_config = require('./check_config');


/*MAIN*/
module.exports = function(type, args){

    check_plafform(shell, 'docker');
    const cfg = check_config();

    switch(type){
      case 'build':
        build(args, cfg);
        break;
      case 'list':
        list(cfg);
        break;
      case 'rmi':
        drop(args, cfg);
        break;
      case 'registry':
        registry(args, cfg);
        break;
      case 'registry-out':
        registryOut();
        break;
      case 'push':
        push(args, cfg);
        break;
      default:
        console.log('This command is not supported');
        break;
    }
}



function push(args, cfg){
  const projectPath = cfg.project_path;
  const imageFilePath = projectPath+IMAGES_LIST_PATH;
  
  const contextPath = projectPath+CONTEXTS_FILE;  
  const readed = fs.readFileSync(contextPath);
  const info = JSON.parse(readed);
  const curContextID = info['current-context'];
  const curContext = info['contexts'][curContextID];
  const registryInfo = curContext.Auth['image-registry'];

  const regName = registryInfo.name;
  const remote = registryInfo.endpoint;
  const image = args.image;
  const project = args.project;


  if(remote == null){
    console.log('There is no container registry linked to this project. Use [add-image-registry  -> login-registry] commands');
    return;
  }
  if(image == null){
    console.log('This command requires the -i or --image options');
    return;
  }
  if(project == null){
    console.log('This command requires the -p or --project options');
    return;
  }

  const pushImage = remote+'/'+project+'/'+image;
  const tagCommand = 'docker tag '+image+' '+pushImage;
  
  shell.exec(tagCommand, {async:false});
  const result = shell.exec('docker push '+pushImage, {async:false});

  if(result.code == SHELL_SUCCESS){
    const readed = fs.readFileSync(imageFilePath);
    let images = JSON.parse(readed);
    let names = Object.keys(images);

    names.forEach((name)=>{
      if(images[name].id == image || image == name){
        images[name].storedLocation = `${regName} (${remote})`;
        images[name].pushTime = _getCurrentTime();
        images[pushImage] = images[name];
        delete images[name];
      }
    });
    const newContent = JSON.stringify(images, null, 2);
    fs.writeFileSync(imageFilePath, newContent);
  }
}



function registryOut(){
  shell.exec('docker logout', {async:false});
}



function _currentRegistry(registryInfo){

  let table = new Array;
  table.push({
    registry: `${registryInfo.name}(${registryInfo.endpoint})`,
    user: registryInfo.user,
    connected_time: registryInfo.connected_time
  })
  printTable(table);
}



function registry(args, cfg){
  const contextPath = cfg.project_path+CONTEXTS_FILE;
  const password = args.password;
  const connect = args.connect;
  const contextFile = JSON.parse(fs.readFileSync(contextPath));
  const curContextID = contextFile['current-context'];
  const curContext = contextFile['contexts'][curContextID];
  const registryInfo = curContext.Auth['image-registry'];
  const remote = registryInfo.endpoint;
  const user = registryInfo.user;
  const regName = registryInfo.name;

  if(connect){
    _currentRegistry(registryInfo);
    return;
  }

  if(remote == null || user == null){
    console.log('This command must be preceded by add-image-registry');
    return;
  }

  if(password == null){
    console.log('This command requires the -p or --password options');
    return;
  }

  let command = 'docker login ';
  command += remote+" "+'-u '+user+' -p '+password;;
  const result = shell.exec(command, {async:false});

  if(result.code == SHELL_SUCCESS){
    contextFile['contexts'][curContextID].Auth['image-registry'] = {
      name: regName,
      endpoint: remote,
      user: user,
      connected_time: _getCurrentTime(),
    }
    const newContent = JSON.stringify(contextFile, null, 2);
    fs.writeFileSync(contextPath, newContent);
  }
}



function drop(args, cfg){

  const id = args.id;
  const all = args.allimage;
  const imageFilePath = cfg.project_path+IMAGES_LIST_PATH;
  const readed = fs.readFileSync(imageFilePath)

  let newImages;
  let command = 'docker rmi '
  let images = JSON.parse(readed);
  let imageNames = Object.keys(images);

  if(args.force != null)
    command += '-f ';
    
  if(all != null){
    if(imageNames.length == 0){
      console.log('There are no images to delete.');
      return;
    }
    imageNames.forEach((name)=>{
      command += images[name].id +' '
    });
    fs.writeFileSync(imageFilePath,'{}');
    shell.exec(command, {async:false});
    return;
  }

  if(id != null){
    command += id;
    imageNames.forEach((name)=>{
      if(images[name].id == id) delete images[name];
    });
    newImages = images;

    const newContent = JSON.stringify(newImages, null, 2);
    fs.writeFileSync(imageFilePath, newContent);
    shell.exec(command, {async:false});
  }else{
    console.log("Enter ID of the image");
  }
}



function list(cfg){
  const imageFilePath = cfg.project_path+IMAGES_LIST_PATH;
  const readed = fs.readFileSync(imageFilePath);
  const images = JSON.parse(readed);
  const imageNames = Object.keys(images);

  if(imageNames.length == 0){
    console.log('There are no images in project.');
    return;
  }

  let table = new Array;
  imageNames.forEach((name)=>{
    table.push({
      NAME:name,
      IMAGE_ID: images[name].id,
      CREATE_TIME: images[name].createTime,
      STORED_LOCATION: images[name].storedLocation,
      PUSH_TIME: images[name].pushTime
    })
  });
  printTable(table);
}



function build(args, cfg){
  const projectPath = cfg.project_path;
  const dockerFilePath = _getDockerFilePath(projectPath);
  let imageName = args.imagename;

  if(imageName == null) 
    imageName = randomWord();

  const dockerCommand = 'docker build '+dockerFilePath+' -t '+ imageName;
  const result  =shell.exec(dockerCommand, {async:false});

  if(result.code == SHELL_SUCCESS){
    let idStartIndex = result.stdout.match('built').index+6;
    const imageID = result.stdout.substring(idStartIndex,idStartIndex+12);
    _writeBuildImage(imageID, imageName, projectPath);
  }
}



function _writeBuildImage(imageID, imageName, projectPath){

  const createTime = _getCurrentTime()
  const imageFilePath = projectPath+IMAGES_LIST_PATH;
  const readed = fs.readFileSync(imageFilePath);

  let images = JSON.parse(readed);
  images[imageName] = new Object;
  images[imageName].id = imageID;
  images[imageName].createTime = createTime;
  images[imageName].storedLocation = '';
  images[imageName].pushTime = '';

  const content = JSON.stringify(images, null, 2);
  fs.writeFileSync(imageFilePath, content);
}



function _getDockerFilePath(project_path){
  try{
    if(!fs.existsSync(project_path+'Dockerfile')){
      if(!fs.existsSync(project_path+'/Dockerfile')){
        console.log("There are no Dockerfile files in this project");
        console.log("Make Docker files in "+ project_path);
        console.log("or "+project_path+'/util/docker');
      }else{
        return project_path+''
      }
    }else{
      return project_path+''
    }
  }catch(err){
    console.error(err);
  }
}



function _getCurrentTime(){
  const date_ob = new Date();

  const createTime = date_ob.getFullYear() 
  + "-" + ("0" + (date_ob.getMonth() + 1)).slice(-2)
  + "-" + ("0" + date_ob.getDate()).slice(-2)
  + " " + date_ob.getHours() 
  + ":" + date_ob.getMinutes()
  + ":" + date_ob.getSeconds();
  return createTime
}
