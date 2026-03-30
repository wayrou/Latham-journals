export const formatComputeUnits = (value: number) => {
    const abs = Math.abs(value);

    if (abs < 1000) {
        return `${Math.floor(value)}`;
    }

    if (abs < 1_000_000) {
        const scaled = value / 1000;
        const rounded = abs >= 10_000 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
        return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
    }

    if (abs < 1_000_000_000) {
        const scaled = value / 1_000_000;
        const rounded = abs >= 10_000_000 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
        return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}m`;
    }

    return value.toExponential(2).replace('+', '');
};
