const fetch = require('node-fetch');

const DEPOT_API = 'http://4.224.186.213/evaluation-service/depots';
const VEHICLE_API = 'http://4.224.186.213/evaluation-service/vehicles';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJteWxhYXNpc2g0NUBnbWFpbC5jb20iLCJleHAiOjE3NzgzMTA3MTIsImlhdCI6MTc3ODMwOTgxMiwiaXNzIjoiQWZmb3JkIE1lZGljYWwgVGVjaG5vbG9naWVzIFByaXZhdGUgTGltaXRlZCIsImp0aSI6ImZjYzUwNzdhLTA3NTMtNDQxYS05NTZjLWRhOGRlZTEzMDllOSIsImxvY2FsZSI6ImVuLUlOIiwibmFtZSI6Im15bGEga2FzdGh1cmkgYXNpc2giLCJzdWIiOiI1NWQ1ODkyYy04MzNhLTQ2ZWUtYThmNC1kYjQ0NTJmMTJkNTQifSwiZW1haWwiOiJteWxhYXNpc2g0NUBnbWFpbC5jb20iLCJuYW1lIjoibXlsYSBrYXN0aHVyaSBhc2lzaCIsInJvbGxObyI6IjIzNDgxYTA1ZzIiLCJhY2Nlc3NDb2RlIjoiZUpkQ3VDIiwiY2xpZW50SUQiOiI1NWQ1ODkyYy04MzNhLTQ2ZWUtYThmNC1kYjQ0NTJmMTJkNTQiLCJjbGllbnRTZWNyZXQiOiJYa1J2SnFXcUtCTUpOUFB6In0.jeWItt1zZx1cu3_rJK6aGrU4sIvXpLReUsdCoymweug';


function solveKnapsack(tasks, capacity) {
    const n = tasks.length;
    const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        const { duration, score } = tasks[i - 1];
        for (let w = 0; w <= capacity; w++) {
            if (duration <= w) {
                dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - duration] + score);
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    let res = dp[n][capacity];
    let w = capacity;
    const selectedTasks = [];
    for (let i = n; i > 0 && res > 0; i--) {
        if (res !== dp[i - 1][w]) {
            selectedTasks.push(tasks[i - 1]);
            res -= tasks[i - 1].score;
            w -= tasks[i - 1].duration;
        }
    }

    return {
        totalScore: dp[n][capacity],
        selectedTasks: selectedTasks
    };
}

async function main() {
    try {
        const headers = {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
        };

        console.log('Fetching depot data...');
        const depotRes = await fetch(DEPOT_API, { headers });
        const depotData = await depotRes.json();

        console.log('Fetching vehicle data...');
        const vehicleRes = await fetch(VEHICLE_API, { headers });
        const vehicleData = await vehicleRes.json();

        if (!depotData.depots || !vehicleData.vehicles) {
            console.error('Failed to fetch data. Check your API token.');
            return;
        }

        const allVehicles = vehicleData.vehicles;

        // The problem asks to determine the subset for "the depot" or "each depot".
        // Assuming we solve for each depot's budget separately if multiple exist.
        depotData.depots.forEach(depot => {
            console.log(`\n--- Optimizing for Depot ID: ${depot.ID} (Budget: ${depot.MechanicHours} hours) ---`);
            
            const result = solveKnapsack(allVehicles, depot.MechanicHours);
            
            console.log(`Maximum Operational Impact Score: ${result.totalScore}`);
            console.log(`Number of Vehicles Serviced: ${result.selectedTasks.length}`);
            console.log('Selected Task IDs:');
            result.selectedTasks.forEach(task => {
                console.log(` - ${task.TaskID} (Duration: ${task.duration}, Score: ${task.score})`);
            });
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
