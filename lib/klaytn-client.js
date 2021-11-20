// test.js
const fs = require("fs")
const Caver = require('caver-js')
const caver = new Caver('https://api.baobab.klaytn.net:8651')
//const contractAddress = "0xe19baf33ab4669d8e09b18a9d0c1170281d7ef39";
const contractAddress ='0x79d4008d19eaea49a9acc9f4b14b0b2dd496c2ae' //test address
const privateKey = '0x6eeb0482ca6ed722378becdcd58b23d611eaa5c37e66a0cb72c89a3c47cab3a5';
const acc ='0x67a134358367ba2f20098bd80a3064d7f55965dc'


async function testFunction() {
    const serviceRegistryABI = require("./build/contracts/test.json");

    // 1. Create a keyring from a private key
    caver.wallet.keyring.createFromPrivateKey(privateKey)

    // 2. Add to wallet with an address and a private key
    caver.wallet.newKeyring(acc, privateKey)
    const instance = new caver.contract(serviceRegistryABI, contractAddress);
   const service = _makeService()

   //const register = await instance.methods.register(service).send({from: acc, gas: 2500000})
   //const register = await instance.methods.getLatestBackupLogs('br2k-test2-id').call({from: acc})
  //  const register = await instance.methods.getService('br2k-test2-id').call({ from: acc, gas: 2500000 })
       const register = await instance.methods.getServiceList().call({from: acc, gas: 2500000}) 
   console.log(register)

}

testFunction()

function _makeService(){
    const kubecontext = _makeKubeContext();
    const container = _makeContainer();
    const STATE_READY = 1;
    const NOT_RUNNING_LOCATION = 999;
    const EMPTY_START_TIME = 0;
    const EMPTY_END_TIME = 0;
    const EMPTY_REPLICAS = 0;

    let service = new Array;
    service.push(
      _makeHeader(),
      _makeRuntime(kubecontext, container),
      _makeBackup(),
      STATE_READY,
      EMPTY_REPLICAS,  //v2_service-registry        
      NOT_RUNNING_LOCATION,
      EMPTY_START_TIME,
      EMPTY_END_TIME
    );
    return service
}

function _makeHeader(){
    let header =new Array;
    header.push(
        'br2k-test2-id',
        acc,
        acc,
        'pslab-hyewon',
        'alsgh@gmail.com',
        '01040658361',
        'app is test',
    )
    return header;
}

function _makeKubeContext(){
    let kubeContext = new Array;
    kubeContext.push(
        [],
        'accessToken',
        'node-id',
        'network-id',
        'http',
        ['192.168.205.10','192.168.205.11','192.168.205.12','192.168.205.13','192.168.205.14','192.168.205.15','192.168.205.16'],
        '3000',
        'node-mount-service',
        'node-mount-etcd',
        'secret'
    )
    return kubeContext;
}

function _makeContainer(){
    let container = new Array;
    container.push(
        'image',
        'image-access-user',
    )
    return container;
}

function  _makeRuntime(kubecontext, container){
    let runtime = new Array;
    runtime.push(
        container,
        kubecontext
    )
    return runtime;
}

function _makeBackup(){
    return [[]];
}

//-----------------------------------------------------------------
// function createService()
// {

//     return [
//         createHeader(),
//         createRuntime(),
//         createBackup(),
//         2,
//         1,
//         99,
//         0,
//         0
//     ]
    
// }

// function createHeader()
// {

//     return ['br2k-test2-id',
//     '0xc785d10da57a63d20d14b54a6b322a136b3dd683',
//     '0xc785d10da57a63d20d14b54a6b322a136b3dd683',
//     'hw-bank',
//     'hhhh@gmail.com',
//     '010-0000-0000',
//     'test1']

// }

// function createRuntime(){

//     return [createContainer(),createKubeContext()]
// }

// function createContainer(){
//     return ['hyewon/br2k-test','hyewon']
// }

// function createKubeContext(){
//     return[
//         ['localhost1','localhost2'],
//         '1dfsefwfsdkljf',
//         'kruffle',
//         'service-object-label',
//         'http',
//         ['203.250.77.154'],
//         '8888',
//         '/tmp/service',
//         '/tmp/service/etcd',
//         'dfkljejfdji'  
//     ]
// }


// // function createState(){

// //     const state_all 
// //     console.log(typeof(state_all))
// //     return state
// // }

// function createBackup(){
//     return []

// }