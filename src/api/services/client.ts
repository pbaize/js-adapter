import { ServiceChannel, ServiceIdentity, Action } from './channel';
import { Transport } from '../../transport/transport';

export class Client extends ServiceChannel {
    public onServiceDisconnect: (f: () => void) => void;
    constructor(private identity: ServiceIdentity, send: Transport['sendAction']) {
        super(send);
    }

    public async dispatch(action: string, payload: any): Promise<any> {
        return this.send(this.identity, action, payload);
    }

    public register(action: string, listener: Action): boolean {
        return super.register(action, listener);
    }

}
