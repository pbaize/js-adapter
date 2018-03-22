declare var require: any;

import { ServiceChannel, ServiceIdentity, Action } from './channel';
import { Transport } from '../../transport/transport';

export class Client extends ServiceChannel {

    constructor(private identity: ServiceIdentity, send: Transport["sendAction"]) {
        super(send)
    }

    async dispatch(action: string, payload: any): Promise<any> {
        return this.send(this.identity, action, payload)
    }

    register(action: string, listener: Action): boolean {
        return super.register(action, listener)
    }

    async onServiceDisconnect(listener: EventListener): Promise<void> {
        return addDesktopEventCallback({
                type: 'service-disconnected',
                uuid: this.identity.uuid,
                action: 'application',
            }, listener, this)
    }
}
