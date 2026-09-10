export const DOC_TYPES = [
    { value: 'unknown', label: 'Unknown' },
    { value: 'id', label: 'ID' },
];

export function docTypeLabel(value) {
    return DOC_TYPES.find((type) => type.value === value)?.label ?? 'Unknown';
}
