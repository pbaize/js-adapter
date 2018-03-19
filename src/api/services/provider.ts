declare var require: any;

import { manageReturn, cb } from './util';
import { ServiceChannel, Action, ServiceIdentity } from './channel';

type ConnectionListener = (adapterIdentity: ServiceIdentity, connectionMessage?: any) => any

export class Provider extends ServiceChannel {
    private connectListener: ConnectionListener;
    private connections: ServiceIdentity[];

    constructor(send) {
        super(send);
        this.connectListener = function () {
            return
        }
        this.connections = [];
    }

    dispatch(to: ServiceIdentity, action: string, payload: any): Promise<any> {
        return manageReturn(super.send, this)(to, action, payload);
    }

    async processConnection(senderId: ServiceIdentity, payload: any) {
        this.connections.push(senderId);
        return this.connectListener(senderId, payload);
    }
   
    publish(action: string, payload: any): Promise<any>[] {
        const func = manageReturn(super.send, this)
        return this.connections.map(to => func(to, action, payload));
    }
    
    onConnection(listener: ConnectionListener): void {
        this.connectListener = listener;
    }


}