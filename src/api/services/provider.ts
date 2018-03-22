import { ServiceChannel, Action, ServiceIdentity } from './channel';
import { Transport } from '../../transport/transport';

export type ConnectionListener = (adapterIdentity: ServiceIdentity, connectionMessage?: any) => any

export class Provider extends ServiceChannel {
    private connectListener: ConnectionListener;
    private connections: ServiceIdentity[];

    constructor(send: Transport["sendAction"]) {
        super(send);
        this.connectListener = function () {
            return
        }
        this.connections = [];
    }

    dispatch(to: ServiceIdentity, action: string, payload: any): Promise<any> {
        return this.send(to, action, payload);
    }

    async processConnection(senderId: ServiceIdentity, payload: any) {
        this.connections.push(senderId);
        return this.connectListener(senderId, payload);
    }
   
    publish(action: string, payload: any): Promise<any>[] {
        return this.connections.map(to => this.send(to, action, payload));
    }
    
    onConnection(listener: ConnectionListener): void {
        this.connectListener = listener;
    }


}