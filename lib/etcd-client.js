const { Etcd3 } = require('etcd3');


module.exports = class EtcdClient{

    constructor(urls, curReplicas){
        let hosts = [];
        this.urls = urls;
        this.curReplicas = curReplicas;

        for(let i=0; i<curReplicas; i++){
            hosts[i] = `http://${urls[i]}:2379`;
        }
        this.client = new Etcd3({hosts: hosts});   
    }

    async addMember(){
        try{
            await this.client.cluster.memberAdd({
                isLearner: true,
                peerURLs: [`http://${this.urls[this.curReplicas]}:2380`]
            })
            return '';
        }catch(e){
            return e
        }
    }


    async addTargetMember(index){
        try{
            const result = await this.client.cluster.memberAdd({
                isLearner: true,
                peerURLs: [`http://${this.urls[index-1]}:2380`]
            })
            return '';
        }catch(e){
            return e
        }
    }

    async removeTargetMember(index){
        try{
            const results = await this.client.cluster.memberList({linearizable: true});
            const id = this._extractMemberID(results.members, `etcd${index}`);
            await this.client.cluster.memberRemove({ID: id})
            return '';
        }catch(e){
            return e;
        }
    }    


    async removeMember(){
        try{
            const results = await this.client.cluster.memberList({linearizable: true});
            const membersLen = results.members.length;
            const id = this._extractMemberID(results.members, `etcd${membersLen}`);
            await this.client.cluster.memberRemove({ID: id})
            return '';
        }catch(e){
            return e;
        }
    }

    _extractMemberID(members, target){
        for(let i=0; i<members.length; i++){
            if(members[i].name == target){
                return members[i].ID;
            }
        }
    } 
}