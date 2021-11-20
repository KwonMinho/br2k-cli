const fs = require('fs');
const Web3 = require('web3');
const { exit } = require('process');
const chalk = require('chalk');
const GAS = 2000000;
const GAS_PRICE = 1;

//enum State { Null, Ready, Running, Stop }const 
const APP_STOP = 3;
const APP_RUNNING = 2;
const APP_READY = 1;
const APP_NULL = 0;
//

const Caver = require('caver-js')




module.exports = class ServiceRegistryClient{

    //#fix blockchaincfg.type == klaytn
    constructor(project, blockchaincfg){
        this.project = project;
        this.blockchaincfg = blockchaincfg;
    }

    async initKlaytn() {
        const sr_abi = require(`${this.project}/util/registry/klay-registry.json`);
        const sr_addr = require(`${this.project}/util/registry/klay-address.json`).address;
        const caver = new Caver(this.blockchaincfg.endpoint);
        caver.wallet.keyring.createFromPrivateKey(this.blockchaincfg.privatekey);
        this.account =this.blockchaincfg.address
        caver.wallet.newKeyring(this.account, this.blockchaincfg.privatekey);
        this.registry = new caver.contract(sr_abi, sr_addr);
        this.type = this.blockchaincfg.type;
    }


    async init(){
        const blockchain_endpoint = this.blockchaincfg.endpoint;
        const provider = new Web3.providers.WebsocketProvider(blockchain_endpoint)
        const web3Client = new Web3(provider);
        const networkID = await web3Client.eth.net.getId();
        const sr_abi = require(`${this.project}/util/registry/ServiceRegistry.json`);
        this.registry = new web3Client.eth.Contract(sr_abi.abi, sr_abi.networks[networkID].address);
        this.account = this.blockchaincfg.account;
        this.password = this.blockchaincfg.password;
        this.type = this.blockchaincfg.type;
        this.web3Client = web3Client;
    }

    async getCurRerplicas(serviceID){
        const option = this._getOption(false, this.type);
        try{
            const serviceInfo = await this.registry.methods.getService(serviceID).call(option);
            return serviceInfo.curReplicas;
        }catch(e){
            return -1;
        }
    }


    async view(serviceID, filePath){
        const option = this._getOption(false, this.type);
        let location;
        try{
            const serviceInfo = await this.registry.methods.getService(serviceID).call(option);
          //  console.log('wwwwww'+serviceInfo.curReplicas)
            if(serviceInfo.state == APP_RUNNING)
                location = await this.registry.methods.getServiceLocation(serviceID).call(option);

            const serviceObject ={
                'header': serviceInfo.header,
                'runtime': serviceInfo.runtime,
                'state': this._getServiceState(serviceInfo.state),
                'currentReplicas': serviceInfo.curReplicas,
                'serviceLocationIndex': serviceInfo.serviceLocationIndex,
                'serviceStartTime': this._timeConverter(serviceInfo.serviceStartTime),
                'serviceEndTime': this._timeConverter(serviceInfo.serviceEndTime)
            }
            const serviceViewObject = JSON.stringify(serviceObject, Object.keys(serviceObject),2);
            
            if(filePath == null) 
                console.log(serviceViewObject+'\n');
            else 
                fs.writeFileSync(filePath, serviceViewObject);

            if(serviceInfo.state== APP_RUNNING){
                console.log(chalk.greenBright('RUNNNING SERVICE'));
                console.log(chalk.magentaBright('Current Service Location: ')
                    +location['protocal']+'://'+location['point']+':'+location['port']+'\n'
                );
            }else if(serviceInfo.state== APP_STOP)
                console.log(chalk.redBright('STOP SERVICE'));
            else if(serviceInfo.state== APP_READY) 
                console.log(chalk.yellowBright('NOT START SERVICE'));
        
            exit(1);
        }catch(e){
            console.log(e);
            exit(1);
        }
    }

    async pauseService(serviceID){
        const option = this._getOption(true, this.type);
        try{
            const result = await this.registry.methods.pauseService(serviceID).send(option);
            exit(1);
        }catch(e){
            console.log(e);
            exit(1);
        }
    }

    async updateReplicas(serviceID, replicas){
        const option = this._getOption(true, this.type);
        try{
            const result = await this.registry.methods.updateReplicas(serviceID, replicas).send(option);
            exit(1);
        }catch(e){
            console.log(e);
            exit(1);
        }
    }


    async startService(serviceID, replicas, secret){
        const option = this._getOption(true, this.type);
        try{
            const result = await this.registry.methods.startService(serviceID, secret, replicas).send(option);
            exit(1);
        }catch(e){
            console.log(e);
            exit(1);
        }
    }



    async register(serviceInfo, contextInfo){
        const service = this._makeService(serviceInfo, contextInfo);
        const option = this._getOption(true, this.type);
        try{
            // console.log( this.web3Client.eth.personal)
            // await this.web3Client.eth.personal.unlockAccount(this.account, this.password, 300).then((response) => {
            //     console.log(response);
            // }).catch((error) => {
            //     console.log(error);
            // });;
            /*
            this.registry.events.ChangeService({toBlock: 'latest'}).on('data', (event)=>{
                console.log('service-registry');
                event.returnValues.serviceID;
                event.returnValues.changeType;
            })
            */
            const result = await this.registry.methods.register(service).send(option);
            return 200;
        }catch(e){
            console.log(e);
            exit(1);
        }
    }


    _getServiceState(index){
        if(index== APP_RUNNING) return 'RUNNING';
        else if(index== APP_STOP) return 'STOP';
        else if(index== APP_READY) return 'READY';
        else if(index== APP_NULL)   return 'EMPTY';
    }

    _timeConverter(UNIX_timestamp){
        if(UNIX_timestamp == 0) return ''
        var a = new Date(UNIX_timestamp * 1000);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var year = a.getFullYear();
        var month = months[a.getMonth()];
        var date = a.getDate();
        var hour = a.getHours();
        var min = a.getMinutes();
        var sec = a.getSeconds();
        var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
        return time;
    }

    _getOption(isWrite,type){
        let option = new Object;
        option.from = this.account;
        if(isWrite){
            option.gas = GAS;
            if(type!='klaytn')
                option.gasPrice = GAS_PRICE; 
        }
        return option
    }

    _makeService(serviceInfo, contextInfo){
        const kubecontext = this._makeKubeContext(contextInfo);
        const container = this._makeContainer(serviceInfo);
        const STATE_READY = 1;
        const NOT_RUNNING_LOCATION = 999;
        const EMPTY_START_TIME = 0;
        const EMPTY_END_TIME = 0;
        const EMPTY_REPLICAS = 0;

        let service = new Array;
        service.push(
          this._makeHeader(serviceInfo),
          this._makeRuntime(kubecontext, container),
          this._makeBackup(),
          STATE_READY,
          EMPTY_REPLICAS,  //v2_service-registry        
          NOT_RUNNING_LOCATION,
          EMPTY_START_TIME,
          EMPTY_END_TIME
        );
        return service
    }

    _makeHeader(service){
        let header =new Array;
        header.push(
            service['id'],
            this.account,
            service['service-account'],
            service['company-name'],
            service['company-email'],
            service['company-contact'],
            service['description'],
        )
        return header;
    }

    _makeKubeContext(contextInfo){
        const context = contextInfo.Context;
        const cluster = contextInfo.Cluster;
        let kubeContext = new Array;
        kubeContext.push(
            context['api-server'],
            context['access-token'],
            cluster['node-id'],
            cluster['network-id'],
            cluster['service-protocol'],
            cluster['service-points'],
            cluster['service-port'].toString(),
            cluster['node-mount-service'],
            cluster['node-mount-etcd'],
            ''
        )
        return kubeContext;
    }

    _makeContainer(service){
        let container = new Array;
        container.push(
            service['image'],
            service['image-access-user'],
        )
        return container;
    }

    _makeRuntime(kubecontext, container){
        let runtime = new Array;
        runtime.push(
            container,
            kubecontext
        )
        return runtime;
    }

    _makeBackup(){
        return [[]];
    }
}