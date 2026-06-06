# IRI_Linter
A small, offline CLI that enforces verify-before-assert on CCO IRIs in your TTL modules: every cco: term must be a verified opaque IRI present in the register, and readable-label forms (cco:has_output) are flagged with the correct opaque IRI suggested.
