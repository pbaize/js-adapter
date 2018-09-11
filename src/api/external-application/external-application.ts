import { Base, EmitterBase } from '../base';
import { Identity } from '../../identity';
import Transport from '../../transport/transport';
import { ExternalApplicationEvents } from '../events/externalApplication';

export interface ExternalApplicationInfo {
    parent: Identity;
}

export default class ExternalApplicationModule extends Base {
    /**
     * Returns an External Application object that represents an existing external application.
     * @param {string} uuid The UUID of the external application to be wrapped
     * @return {Promise.<ExternalApplication>}
     */
    public wrap(uuid: string): Promise<ExternalApplication> {
        return Promise.resolve(new ExternalApplication(this.wire, {uuid}));
    }
}

/**
 * @classdesc An ExternalApplication object representing an application. Allows
 * the developer to create, execute, show and close an external application as
 * well as listen to application events.
 * @class
 */
export class ExternalApplication extends EmitterBase<ExternalApplicationEvents> {

    constructor(wire: Transport, public identity: Identity) {
        super(wire, ['external-application', identity.uuid]);
    }

    /**
     * Retrieves information about the external application.
     * @return {Promise.<ExternalApplicationInfo>}
     * @tutorial ExternalApplication.getInfo
     */
    public getInfo(): Promise<ExternalApplicationInfo> {
        return this.wire.sendAction('get-external-application-info', this.identity).then(({ payload }) => payload.data);
    }
}
