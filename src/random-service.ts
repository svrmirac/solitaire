export async function request<T>(): Promise<T> {
    const response = await fetch('https://api.random.org/json-rpc/4/invoke', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "method": "generateIntegers",
            "params": {
                "apiKey": "2c2e451e-1e6a-44da-b1ef-33a68000623d",
                "n": 104,
                "min": 0,
                "max": 103,
                "replacement": false,
                "base": 10,
                "pregeneratedRandomization": null
            },
            "id": 1
        })
    });
    const data = await response.json();
    return data as T;
}

export interface RandomResponse {
    result: {
        random: {
            data: Array<number>
        }
    }
}
