export class MetricUtilities {
    private static cpuStrToNumber(cpustr: string): Number {
        let mult_factor = 1000000000;
        if(cpustr && cpustr.endsWith('m')) {
            mult_factor = 1000000;
        }else if(cpustr && cpustr.endsWith('n')) {
            mult_factor = 1;
        }

        return Number(cpustr.replace('m','').replace('n','')) * mult_factor;
    }

    private static memStrToNumber(memstr: string): Number {
        let mult_factor = 1000000;
        if(memstr && memstr.endsWith('Mi')) {
            mult_factor = 1000;
        }else if(memstr && memstr.endsWith('Ki')) {
            mult_factor = 1;
        }
        return Number(memstr.replace('Ki','').replace('Mi','').replace('Gi','')) * mult_factor;
    }

    public static parseDeploymentMetrics(deployment: string, pods: any, metrics: any): {cpu: Number, cpupcg: Number, memory: Number, mempcg: Number}{
        const nameMetricMap = new Map();
        if (metrics.items) {
            metrics.items.forEach((m: any) => {
                nameMetricMap.set(m.metadata.name, m);
            })
        }

        let totalCpuUsage = 0;
        let totalMemoryUsage = 0;
        let mempcg = 0;
        let cpupcg = 0;

        if (pods && pods.items && pods.items.length > 0) {
            pods.items.forEach((pod: any) => {
                if (pod.spec.containers) {
                    const deployname = pod.spec.containers[0].name;
                    if (deployname === deployment) {
                        const metric = nameMetricMap.get(pod.metadata.name);
                        if (metric) {
                            console.log(metric);
                            const cpustr = metric.containers[0].usage.cpu;
                            const memorystr = metric.containers[0].usage.memory;

                            // @ts-ignore
                            totalCpuUsage += this.cpuStrToNumber(cpustr);
                            // @ts-ignore
                            totalMemoryUsage += this.memStrToNumber(memorystr);
                        }
                    }
                }
            });

            let maxCpuLimit: number;
            if (!pods.items[0].spec.containers[0].resources.limits) {
                maxCpuLimit = 9999999999;
            }else{
                let mult_factor = 1000000000;
                if(pods.items[0].spec.containers[0].resources.limits.cpu && pods.items[0].spec.containers[0].resources.limits.cpu.endsWith('m')) {
                    mult_factor = 1000000;
                }
                maxCpuLimit = Number(pods.items[0].spec.containers[0].resources.limits.cpu.replace('m','')) * mult_factor;
            }

            let maxMemoryLimit: number;
            if (!pods.items[0].spec.containers[0].resources.limits) {
                maxMemoryLimit = 9999999999;
            }else{
                let mult_factor = 1000000;
                if(pods.items[0].spec.containers[0].resources.limits.memory && pods.items[0].spec.containers[0].resources.limits.memory.endsWith('Mi')) {
                    mult_factor = 1000;
                }else if(pods.items[0].spec.containers[0].resources.limits.memory && pods.items[0].spec.containers[0].resources.limits.memory.endsWith('Ki')) {
                    mult_factor = 1;
                }
                maxMemoryLimit = Number(pods.items[0].spec.containers[0].resources.limits.memory.replace('Ki','').replace('Mi','').replace('Gi','')) * mult_factor;
            }

            cpupcg = Math.round(totalCpuUsage * 100/maxCpuLimit);
            mempcg = Math.round(totalMemoryUsage * 100/maxMemoryLimit);

            console.log(`CPU: ${totalCpuUsage}, Memory: ${totalMemoryUsage}, CPU %: ${cpupcg}, Memory %: ${mempcg}, Max CPU: ${maxCpuLimit}, Max Memory: ${maxMemoryLimit}`);
        }


        return {
            cpu: totalCpuUsage,
            cpupcg,
            memory: totalMemoryUsage,
            mempcg
        }
    }
}