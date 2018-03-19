/*global fin */
'use strict';
declare var fin: any;
declare var require: any;


import {cb} from './util';
import { Identity } from '../../identity';

const sendMessageToDesktop = require('../socket').sendMessageToDesktop;

const noop = (): void => undefined;

const idOrResult = (func: (...args: any[]) => any) => (...args: any[] ) => {
    let res = func(...args)
    return res === undefined ? args[1] : res
}

export interface ServiceIdentity extends Identity {
}
export type Action = (() => any) | ((payload: any) => any) | ((payload: any, id: ServiceIdentity) => any);
export type Middleware = (() => any) | ((action: string) => any) | ((action: string, payload: any) => any) | ((action: string, payload: any, id: ServiceIdentity) => any);

export class ServiceChannel {
    protected subscriptions: any;
    public defaultAction: (action?: string, payload?: any, senderIdentity?: ServiceIdentity) => any;
    private preAction: (...args: any[]) => any;
    private postAction: (...args: any[]) => any;
    private errorMiddleware: (...args: any[]) => any;
    private defaultSet: boolean;

    constructor (send) {
        this.defaultSet = false;
        this.subscriptions = new Map<string, () => any>();
        this.defaultAction = function () {
            throw new Error('listener not implemented')
        }
        this._send = (to: Identity, action: string, payload: any): Promise<void> => new Promise<void>((resolve, reject) => send('send-service-message', { uuid: to.uuid, name: to.name, action, payload }, (z: any) => resolve(z.result), reject))
    }

    protected async send (to: Identity, action: string, payload: any, ack: cb, nack: cb) {
        try {
           const res = await this._send(to, action, payload);
           ack(res);
        } catch (e) {
           nack(e);
        }
    }

    async processAction(action: string, payload: any, senderIdentity: ServiceIdentity) {
        try {
            const mainAction = this.subscriptions.has(action) 
                ? this.subscriptions.get(action)
                : (payload: any, id: ServiceIdentity) => this.defaultAction(action, payload, id);
            let a = this.preAction ? await this.preAction(action, payload, senderIdentity) : payload;
            let b = await mainAction(a, senderIdentity);
            return this.postAction 
                ? await this.postAction(action, b, senderIdentity)
                : b
        } catch (e) {
            if (this.errorMiddleware) {
                return this.errorMiddleware(action, e, senderIdentity)
            } throw e;
        }
    }

    beforeAction(func: Action) {
        if (this.preAction) {
            throw new Error('Already registered beforeAction middleware')
        }
        this.preAction = idOrResult(func)
    }

    onError(func: (e: any, action: string,id: Identity) => any) {
        if (this.errorMiddleware) {
            throw new Error('Already registered error middleware')
        }
        this.errorMiddleware = func
    }

    afterAction(func: Action) {
        if (this.postAction) {
            throw new Error('Already registered afterAction middleware')
        }
        this.postAction = idOrResult(func)
    }

    remove(action: string): void {
        this.subscriptions.delete(action);
    }

    setDefaultAction(func: (action?: string, payload?: any, senderIdentity?: ServiceIdentity) => any): void {
        if (this.defaultSet) {
            throw new Error('default action can only be set once');
        } else {
            this.defaultAction = func;
            this.defaultSet = true;
        }
    }

    register(topic: string, listener: Action) {
        //TODO create map of subscriptions
        if (this.subscriptions.has(topic)) {
            throw new Error(`Subscription already registered for action: ${topic}. Unsubscribe before adding new subscription`) 
        } else {
            this.subscriptions.set(topic, listener);
            return true
        }
    }
}