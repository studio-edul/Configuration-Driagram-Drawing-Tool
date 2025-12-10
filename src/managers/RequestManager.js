<<<<<<< HEAD
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
        console.log(`RequestManager: Added ${this.activeType} request at ${x}, ${y}`);
    }

    setRequestType(type) {
        this.activeType = type;
    }
}
=======
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
        console.log(`RequestManager: Added ${this.activeType} request at ${x}, ${y}`);
    }

    setRequestType(type) {
        this.activeType = type;
    }
}
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
