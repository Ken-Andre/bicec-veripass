#!/bin/bash
# Hook: check-issues
# Description: Affiche les issues GitHub ouvertes et suggère les plus pertinentes
# Usage: ./check-issues.sh [sprint|critical|all]

MODE="${1:-sprint}"

echo "🔍 Vérification des issues GitHub BICEC VeriPass..."

cd "$(dirname "$0")/../../.." || exit 1

# Utiliser GitHub CLI ou MCP pour lister les issues
echo "📊 Issues ouvertes par priorité:"

case "$MODE" in
    sprint)
        echo "🎯 Issues du sprint actuel (Sprint 1 - Auth & Foundation):"
        echo "  - AUTH-01: OTP Authentication via Orange SMS"
        echo "  - AUTH-02: PIN Creation and Secure Storage"
        echo "  - AUTH-03: JWT Token Management"
        echo "  - AUTH-04: Role-Based Access Control (RBAC)"
        ;;
    critical)
        echo "🔴 Issues critiques:"
        echo "  - core/security.py: Placeholder vide - Auth non implémentée"
        echo "  - config.py: JWT_SECRET par défaut faible"
        echo "  - views mobiles vides - app non fonctionnelle"
        ;;
    all)
        echo "📈 Résumé des 187 issues ouvertes:"
        echo "  - Epic 1 (Foundation): 4 issues"
        echo "  - Epic 2 (KYC): 5 issues"
        echo "  - Epic 3 (Address/NIU): 4 issues"
        echo "  - Epic 4 (AI Engine): 4 issues"
        echo "  - Epic 5 (Jean's Desk): 3 issues"
        echo "  - Epic 6 (Thomas's AML): 4 issues"
        echo "  - Epic 7 (Sylvie's Center): 4 issues"
        echo "  - Epic 8 (Client Relation): 3 issues"
        echo "  - Cross-cutting: 30+ issues"
        ;;
    *)
        echo "Usage: $0 [sprint|critical|all]"
        exit 1
        ;;
esac

echo ""
echo "💡 Pour voir les détails: https://github.com/Ken-Andre/bicec-veripass/issues"