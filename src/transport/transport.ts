import {
    Wire,
    WireConstructor,
    READY_STATE,
    isExistingConnectConfig,
    isNewConnectConfig,
    ExistingConnectConfig,
    ConnectConfig,
    InternalConnectConfig
} from './wire';
import { Identity } from '../identity';
import { EventEmitter } from 'events';
import { Environment } from '../environment/environment';
import {
    UnexpectedActionError,
    DuplicateCorrelationError,
    NoAckError,
    RuntimeError
} from './transport-errors';

declare var fin: any;

export interface MessageHandler {
    (data: Function): boolean;
}

export class Transport extends EventEmitter {
    protected wireListeners: { resolve: Function, reject: Function }[] = [];
    protected uncorrelatedListener: Function;
    protected messageHandlers: MessageHandler[] = [];
    public me: Identity;
    protected wire: Wire;
    public environment: Environment;
    public topicRefMap: Map<string, number> = new Map();
    public sendRaw: Wire['send'];

    constructor(wireType: WireConstructor, environment: Environment) {
        super();
        this.wire = new wireType(this.onmessage.bind(this));
        this.environment = environment;
        this.sendRaw = this.wire.send;
        this.registerMessageHandler(this.handleMessage.bind(this));
        this.wire.on('disconnected', () => {
            this.emit('disconnected');
        });
    }

    public connectSync = (config: ConnectConfig): any => {
        const { uuid, name } = config;
        this.me = { uuid, name };
        this.wire.connectSync();

    }

    public async connect(config: InternalConnectConfig): Promise<string> {
        if (isExistingConnectConfig(config)) {
            return this.connectByPort(config);
        } else if (isNewConnectConfig(config)) {
            const port = await this.environment.retrievePort(config);
            return this.connectByPort(Object.assign({}, config, { address: `ws://localhost:${port}` }));
        }
    }

    public async connectByPort(config: ExistingConnectConfig): Promise<string> {
        const { address, uuid, name } = config;
        const reqAuthPayload = Object.assign({}, config, { type: 'file-token' });

        this.me = { uuid, name };

        await this.wire.connect(address);

        const requestExtAuthRet = await this.sendAction<void, any, AuthorizationPayload>('request-external-authorization', {
            uuid,
            type: 'file-token'
        }, true);

        if (requestExtAuthRet.action !== 'external-authorization-response') {
            throw new UnexpectedActionError(requestExtAuthRet.action);
        }

        const token: string = requestExtAuthRet.payload.token;
        await this.environment.writeToken(requestExtAuthRet.payload.file, requestExtAuthRet.payload.token);
        const requestAuthRet = await this.sendAction<void, any, AuthorizationPayload>('request-authorization', reqAuthPayload, true);

        if (requestAuthRet.action !== 'authorization-response') {
            throw new UnexpectedActionError(requestAuthRet.action);
        } else if (requestAuthRet.payload.success !== true) {
            throw new RuntimeError(requestAuthRet.payload);
        } else {
            return token;
        }
    }

    /* `READY_STATE` is an instance var set by `constructor` to reference the `WebTransportSocket.READY_STATE` enum.
     * This is syntactic sugar that makes the enum accessible through the `wire` property of the various `fin` singletons.
     * For example, `fin.system.wire.READY_STATE` is a shortcut to `fin.system.wire.wire.constructor.READY_STATE`.
     * However it is accessed, the enum is useful for interrogating the state of the web socket on send failure.
     * The `err.readyState` value is passed to the `reject` handler of the promise returned by either of
     * `sendAction` or `ferryAction`, and hence all the API methods in the various `fin` singletons that call them.
     * The enum can be used in two distinct ways by the `reject` handler (using `fin.System.getVersion` by way of example):
     * 1. State name by state value:
     * fin.system.getVersion().catch(err => { console.log('State:', fin.system.wire.READY_STATE[err.readyState]); });
     * 2. State value by state name:
     * fin.system.getVersion().catch(err => { console.log('Closed:', err.readyState === fin.system.wire.READY_STATE.CLOSED); });
     * Note that `reject` is called when and only when `readyState` is not `OPEN`.
     */
    public READY_STATE = READY_STATE;

    public sendAction<TResData,
                      TSendData = Identity,
                      TPayloadType = Payload<TResData>>
                      (action: string,
                       payload: TSendData = <TSendData>{},
                       uncorrelated: boolean = false
                    ): Promise<Message<TResData, TPayloadType>> {
        return new Promise((resolve, reject) => {
            const id = this.environment.getNextMessageId();
            const msg = {
                action,
                payload,
                messageId: id
            };

            return this.wire.send(msg)
                .then(() => this.addWireListener(id, resolve, reject, uncorrelated))
                .catch(reject);
        });
    }

    public ferryAction(data: any): Promise<Message<any>> {
        return new Promise((resolve, reject) => {
            const id = this.environment.getNextMessageId();
            data.messageId = id;

            const resolver = (data: any) => { resolve(data.payload); };

            return this.wire.send(data)
                .then(() => this.addWireListener(id, resolver, reject, false))
                .catch(reject);
        });
    }

    public registerMessageHandler(handler: MessageHandler): void {
        this.messageHandlers.unshift(handler);
    }

    protected addWireListener(id: number, resolve: Function, reject: Function, uncorrelated: boolean): void {
        if (uncorrelated) {
            this.uncorrelatedListener = resolve;
        } else if (id in this.wireListeners) {
            reject(new DuplicateCorrelationError(String(id)));
        } else {
            this.wireListeners[id] = { resolve, reject };
        }
        // Timeout and reject()?
    }

    // This method executes message handlers until the _one_ that handles the message (returns truthy) has run
    protected onmessage<T>(data: Message<Payload<T>>): void {

        for (const h of this.messageHandlers) {
            h.call(null, data);
        }
    }

    protected handleMessage<T>(data: Message<Payload<T>>): boolean {
        // tslint:disable-next-line
        const id: number = data.correlationId || NaN;

        if (!('correlationId' in data)) {
            this.uncorrelatedListener.call(null, data);
            // tslint:disable-next-line
            this.uncorrelatedListener = () => { };
        } else if (!(id in this.wireListeners)) {
            return false;
        } else {
            const { resolve, reject } = this.wireListeners[id];
            if (data.action !== 'ack') {
                reject(new NoAckError(data.action));
            } else if (!('payload' in data) || !data.payload.success) {
                reject(new RuntimeError(data));
            } else {
                resolve.call(null, data);
            }

            delete this.wireListeners[id];
        }
        return true;
    }

}

export default Transport;

export interface Transport {
    sendAction(action: 'request-external-authorization', payload: {}, uncorrelated: true): Promise<Message<AuthorizationPayload>>;
    sendAction<T, U>(action: string, payload: T, uncorrelated: boolean): Promise<Message<U>>;
    topicRefMap: Map<string, number>;
}

export class Message<T, U = Payload<T>> {
    public action: string;
    public payload: U;
    public correlationId?: number;
}
export class Payload<T> {
    public success: boolean;
    public data: T;
}
export class AuthorizationPayload extends Payload<void> {
    public token: string;
    public file: string;
}
