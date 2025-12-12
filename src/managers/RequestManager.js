export class RequestManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
        this.activeType = 'POWER'; // 'POWER' | 'NETWORK'
    }

    addRequest(x, y) {
        const id = `req-${Date.now()}`;
        const request = {
            id,
            type: this.activeType,
            x,
            y,
            label: this.activeType === 'POWER' ? 'P' : 'N'
        };

        this.dataStore.addRequest(request);
    }

    setRequestType(type) {
        this.activeType = type;
    }
}
