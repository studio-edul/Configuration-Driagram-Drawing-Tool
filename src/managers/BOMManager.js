<<<<<<< HEAD
export class BOMManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
    }

    generateBOM() {
        const nodes = this.dataStore.getState().nodes;
        const bom = {};

        Object.values(nodes).forEach(node => {
            if (!bom[node.type]) {
                bom[node.type] = { count: 0, items: [] };
            }
            bom[node.type].count++;
            bom[node.type].items.push(node.id);
        });

        return bom;
    }

    logBOM() {
        console.table(this.generateBOM());
    }
}
=======
export class BOMManager {
    constructor(dataStore) {
        this.dataStore = dataStore;
    }

    generateBOM() {
        const nodes = this.dataStore.getState().nodes;
        const bom = {};

        Object.values(nodes).forEach(node => {
            if (!bom[node.type]) {
                bom[node.type] = { count: 0, items: [] };
            }
            bom[node.type].count++;
            bom[node.type].items.push(node.id);
        });

        return bom;
    }

    logBOM() {
        console.table(this.generateBOM());
    }
}
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4
