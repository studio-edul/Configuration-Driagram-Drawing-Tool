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
