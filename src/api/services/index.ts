import { cb, EventListener } from './util';
import { Client } from './client';
import { Identity } from '../../identity';
import { Provider } from './provider';
import { ServiceIdentity } from './channel';
import { Bare } from '../base';

export interface Options {
    wait?: boolean;
    uuid: string;
    payload?: any;
}

export class Service extends Bare {
async onServiceConnect(listener: EventListener): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        this.addDesktopEventCallback({
            topic: 'system',
            type: 'service-connected'
        }, listener, this, resolve, reject);
    });
}

async connect(options: Options): Promise<Client> {
    try {
        const serviceIdentity = await this.wire.sendAction<ServiceIdentity>('send-service-message', Object.assign({
                connectAction: true,
                wait: true,
            }, options));
        const channel = new Client(serviceIdentity, this.wire.sendAction);
        serviceMap.set(serviceIdentity.uuid, channel);
        return channel;
    } catch (e) {
        throw e;
    }
}

async register(): Promise<Provider> {
    try {
        const serviceIdentity = await this.wire.sendAction('register-service', { });
        const channel = new Provider(this.wire.sendAction);
        serviceMap.set(serviceIdentity.uuid, channel);
        return channel;
    } catch (e) {
        throw e;
    }
}

}

interface PluginSubscribeSuccess {
    uuid: string;
    name: string;
    serviceName: string;
}

