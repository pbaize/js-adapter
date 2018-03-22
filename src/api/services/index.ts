import { Client } from './client';
import { Identity } from '../../identity';
import { Provider } from './provider';
import { ServiceIdentity } from './channel';
import { Bare } from '../base';
import { Transport } from '../../transport/transport';

export interface Options {
    wait?: boolean;
    uuid: string;
    payload?: any;
}

export class Service extends Bare {
    private serviceMap: Map;
    constructor(wire: Transport) {
        super(wire)
        this.serviceMap = new Map();
    }
async onServiceConnect(listener: EventListener): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        this.wire.addDesktopEventCallback({
            topic: 'system',
            type: 'service-connected'
        }, listener, this, resolve, reject);
    });
}

async connect(options: Options): Promise<Client> {
    try {
        const {payload: {data: serviceIdentity}} = await this.wire.sendAction<ServiceIdentity, Options>('send-service-message', Object.assign({
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
        const { payload: { data: serviceIdentity } } = await this.wire.sendAction<ServiceIdentity, {}>('register-service', { });
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

