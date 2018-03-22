import { Client } from './client';
import { Identity } from '../../identity';
import { Provider } from './provider';
import { ServiceIdentity } from './channel';
import { Base } from '../base';
import { Transport, Message, Payload } from '../../transport/transport';

export interface Options {
    wait?: boolean;
    uuid: string;
    payload?: any;
}

export interface ServicePayload {
    payload: Payload<any>;
}
export interface ServiceMessage extends Message<any, ServicePayload> {
  senderIdentity: Identity;
  ackToSender: any;
  serviceIdentity: Identity;
  connectAction: boolean;
}

export class Service extends Base {
    private serviceMap: Map<string, Provider | Client>;
    constructor(wire: Transport) {
        super(wire);
        this.serviceMap = new Map();
    }

    public async onServiceConnect(identity: Identity, listener: EventListener): Promise<void> {
            this.registerEventListener({
                topic: 'service',
                type: 'connected',
                ...identity
            });
            this.on('connected', listener);
    }

    public async connect(options: Options): Promise<Client> {
        try {
            const { payload: { data: serviceIdentity } } = await this.wire.sendAction<ServiceIdentity, Options>('send-service-message', Object.assign({
                connectAction: true,
                wait: true
            }, options));
            const channel = new Client(serviceIdentity, this.wire.sendAction);
            channel.onServiceDisconnect = (listener: () => void) => {
                this.registerEventListener({
                    topic: 'service',
                    type: 'disconnected',
                    ...serviceIdentity
                });
                this.on('disconnected', listener);
            };
            this.serviceMap.set(serviceIdentity.uuid, channel);
            return channel;
        } catch (e) {
            throw e;
        }
    }

    public async register(): Promise<Provider> {
        try {
            const { payload: { data: serviceIdentity } } = await this.wire.sendAction<ServiceIdentity, {}>('register-service', {});
            const channel = new Provider(this.wire.sendAction);
            this.serviceMap.set(serviceIdentity.uuid, channel);
            return channel;
        } catch (e) {
            throw e;
        }
    }
    public onmessage = (msg: ServiceMessage) => {
      if (msg.action === 'process-service-action') {
          this.processServiceMessage(msg);
          return true;
      }
      return false;
    }
    private async processServiceMessage (msg: ServiceMessage) {
        const { senderIdentity, serviceIdentity, action, ackToSender, payload } = msg;
        const bus = this.serviceMap.get(serviceIdentity.uuid);
        try {
            let res;
            if (!bus) {
                throw Error('Service not found');
            }
            if (msg.connectAction) {
                if (!(bus instanceof Provider)) {
                    throw Error('Cannot connect to a plugin');
                }
                res = await bus.processConnection(senderIdentity, payload);
            } else {
                res = await bus.processAction(action, payload, senderIdentity);
            }
            ackToSender.payload.payload = ackToSender.payload.payload || {};
            ackToSender.payload.payload.result = res;
            this.wire.sendRaw(ackToSender);
        } catch (e) {
            ackToSender.success = false;
            ackToSender.reason = e.message;
            this.wire.sendRaw(ackToSender);
        }
    }

}

interface PluginSubscribeSuccess {
    uuid: string;
    name: string;
    serviceName: string;
}
