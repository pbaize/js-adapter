declare var require: any;

import { manageReturn, cb, EventListener } from './util';
import { ServiceChannel, ServiceIdentity, Action } from './channel';
const addDesktopEventCallback = require('../desktop-messaging.js').addDesktopEventCallback;

export class Client extends ServiceChannel {

    constructor(private identity: ServiceIdentity, send) {
        super(send)
    }

    async dispatch(action: string, payload: any): Promise<any> {
        return manageReturn(super.send, this)(this.identity, action, payload)
    }

    register(action: string, listener: Action): boolean {
        return super.register(action, listener)
    }

    async onServiceDisconnect(listener: EventListener): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            addDesktopEventCallback({
                type: 'service-disconnected',
                uuid: this.identity.uuid,
                action: 'application',
            }, listener, this, resolve, reject)
        });
    }
}
