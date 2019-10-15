import { WebContents } from '../webcontents/webcontents';
import Transport, { Message } from '../../transport/transport';
import { Identity } from '../../identity';
import { Base } from '../base';
import { ViewEvents } from '../events/browserview';
import { _Window } from '../window/window';
import { EventEmitter } from 'events';
import { WindowOption } from '../window/windowOption';
export interface AutoResizeOptions {
    /**
     * If true, the view's width will grow and shrink together with the window. false
     * by default.
     */
    width: boolean;
    /**
     * If true, the view's height will grow and shrink together with the window. false
     * by default.
     */
    height: boolean;
    /**
     * If true, the view's x position and width will grow and shrink proportionly with
     * the window. false by default.
     */
    horizontal: boolean;
    /**
     * If true, the view's y position and height will grow and shrink proportinaly with
     * the window. false by default.
     */
    vertical: boolean;
}
export interface BrowserViewOptions {
    autoResize?: AutoResizeOptions;
}
export interface BrowserViewCreationOptions extends BrowserViewOptions {
    name: string;
    url: string;
    target: Identity;
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
const windowRequests = new EventEmitter();
export class BrowserViewModule extends Base {
    constructor(wire: Transport) {
        super(wire);
        wire.registerMessageHandler((data:Message<{listenerId: string, options: WindowOption}>) => {
            if (data.action === 'new-window-requested') {
                const {listenerId, options} = data.payload;
                windowRequests.emit(listenerId, options)
                return true;
            }
        })
    }
    public async create(options: BrowserViewCreationOptions) {
        const uuid = this.wire.me.uuid;
        await this.wire.sendAction('create-browser-view' , {...options, uuid});
        return this.wrapSync({uuid, name: options.name});
    }
    public wrapSync(identity: Identity) {
        return new BrowserView(this.wire, identity);
    }
}

export class BrowserView extends WebContents<ViewEvents> {
    constructor(wire: Transport, public identity: Identity) {
        super(wire, identity, 'view');
        this.topic = 'view';
    }
    public attach = async (target: Identity) => {
        await this.wire.sendAction('attach-browser-view', {target, ...this.identity});
    }

    /**
    * Destroys the current view
    * @return {Promise.<void>}
    * @tutorial BrowserView.destroy
    */
    public destroy = async () => {
        await this.wire.sendAction('destroy-browser-view', { ...this.identity });
    }
    public show = async () => {
        await this.wire.sendAction('show-browser-view', { ...this.identity });
    }
    public hide = async () => {
        await this.wire.sendAction('hide-browser-view', { ...this.identity });
    }
    public setBounds = async (bounds: any) => {
        await this.wire.sendAction('set-browser-view-bounds', {bounds, ...this.identity});
    }
    public getInfo = async () => {
        const ack = await this.wire.sendAction('get-browser-view-info', {...this.identity});
        return ack.payload.data;
    }
    /**
    * Retrieves the window the view is currently attached to.
    * @experimental
    * @return {Promise.<_Window>}
    * @tutorial BrowserView.getCurrentWindow
    */
    public getCurrentWindow = async () => {
        const { payload: { data } } = await this.wire.sendAction<{data: Identity}>('get-view-window', {...this.identity});
        return new _Window(this.wire, data);
    }
    /**
     * setCustomWindowHandler
     */
    public setCustomWindowHandler = async (urls: string | string[], handler: (options: WindowOption) => void) => {
        const patterns = Array.isArray(urls) ? urls : [urls];
        const { payload: { data } } = await this.wire.sendAction<{ data: { listenerId: string } }>('set-custom-window-handler', { patterns, ...this.identity });
        const { listenerId } = data;
        windowRequests.on(listenerId, handler);
        return () => {
            windowRequests.removeAllListeners(listenerId);
        }
    }
}
