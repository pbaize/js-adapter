import { conn } from './connect';
import * as assert from 'assert';

describe('services', async () => {
    const fin = await conn();
    it('can register', async () => {
        console.log('running')
        await fin.Service.register();
        assert(true)
    });
});