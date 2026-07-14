// Shared Name Matching logic for mock adapters and local test suites

function deterministicNameMatch(name, candidates) {
    const cleanName = name.toLowerCase().replace(/['"\.]/g, '').trim();
    
    function normalizePrefixes(str) {
        return str
            .replace(/^(mohd|md|mohammad|mohammed)\s+/g, 'md ')
            .replace(/\s+bhai$/g, '')
            .trim();
    }

    const normName = normalizePrefixes(cleanName);

    for (const c of candidates) {
        const cClean = c.name.toLowerCase().replace(/['"\.]/g, '').trim();
        const cNorm = normalizePrefixes(cClean);

        if (normName === cNorm) {
            return { is_likely_match: true, matched_offender_id: c.offender_id, confidence: 0.95, reasoning_summary: `Direct normalization match ("${normName}")` };
        }

        if (normName.includes(cNorm) || cNorm.includes(normName)) {
            return { is_likely_match: true, matched_offender_id: c.offender_id, confidence: 0.85, reasoning_summary: `Fuzzy inclusion match ("${normName}" vs "${cNorm}")` };
        }

        for (const alias of c.aliases) {
            const aliasClean = alias.toLowerCase().replace(/['"\.]/g, '').trim();
            const aliasNorm = normalizePrefixes(aliasClean);
            if (normName === aliasNorm || normName.includes(aliasNorm) || aliasNorm.includes(normName)) {
                return { is_likely_match: true, matched_offender_id: c.offender_id, confidence: 0.90, reasoning_summary: `Alias overlap match ("${alias}")` };
            }
        }
    }

    return { is_likely_match: false, matched_offender_id: null, confidence: 0.0, reasoning_summary: 'No matching baseline candidate found' };
}

module.exports = {
    deterministicNameMatch
};
