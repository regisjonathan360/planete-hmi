#!/bin/bash

# Exemples cURL pour tester l'API /api/admin/radio/available-sources
# 
# Avant d'utiliser ces exemples, assurez-vous que:
# 1. Le serveur Next.js est en cours d'exécution (npm run dev)
# 2. Vous avez un token JWT d'admin valide
# 3. Remplacez AUTH_TOKEN par votre token réel

# Configuration
API_URL="http://localhost:3000"
ENDPOINT="/api/admin/radio/available-sources"
AUTH_TOKEN="YOUR_ADMIN_JWT_TOKEN_HERE"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Test sans authentification (devrait retourner 401)
# ============================================================================
echo -e "${BLUE}Test 1: Requête sans authentification${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' | jq ."
echo -e ""
echo -e "${YELLOW}Résultat attendu:${NC}"
curl -s -X GET "$API_URL$ENDPOINT" | jq .
echo -e "\n"

# ============================================================================
# 2. Test avec authentification (vérifier le token)
# ============================================================================
echo -e "${BLUE}Test 2: Requête avec authentification${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq ."
echo -e ""
echo -e "${YELLOW}Résultat attendu: Liste des classements et sources${NC}"

if [ "$AUTH_TOKEN" = "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  echo -e "${RED}ATTENTION: Remplacez AUTH_TOKEN par votre token réel${NC}"
else
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" | jq .
fi
echo -e "\n"

# ============================================================================
# 3. Test avec jq - Filtrer uniquement les classements
# ============================================================================
echo -e "${BLUE}Test 3: Récupérer uniquement les classements${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq '.charts[]'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Liste des classements${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.charts[]'
fi
echo -e "\n"

# ============================================================================
# 4. Test avec jq - Filtrer uniquement les sources
# ============================================================================
echo -e "${BLUE}Test 4: Récupérer uniquement les sources${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq '.sources[]'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Liste des sources${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.sources[]'
fi
echo -e "\n"

# ============================================================================
# 5. Test avec jq - Compter les classements et sources
# ============================================================================
echo -e "${BLUE}Test 5: Compter les classements et sources${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq '{charts_count: (.charts | length), sources_count: (.sources | length)}'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Nombre total de classements et sources${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '{charts_count: (.charts | length), sources_count: (.sources | length)}'
fi
echo -e "\n"

# ============================================================================
# 6. Test avec jq - Filtrer les sources manuelles
# ============================================================================
echo -e "${BLUE}Test 6: Récupérer uniquement les sources manuelles${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq '.sources[] | select(.type == \"manual\")'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Liste des playlists manuelles${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.sources[] | select(.type == "manual")'
fi
echo -e "\n"

# ============================================================================
# 7. Test avec jq - Trier les classements par nombre de chansons
# ============================================================================
echo -e "${BLUE}Test 7: Trier les classements par nombre de chansons (décroissant)${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq '.charts | sort_by(.track_count) | reverse[]'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Classements triés par nombre de chansons${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.charts | sort_by(.track_count) | reverse[]'
fi
echo -e "\n"

# ============================================================================
# 8. Test avec jq - Grouper les sources par type
# ============================================================================
echo -e "${BLUE}Test 8: Grouper les sources par type${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN' | jq 'group_by(.sources[].type)'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: Sources groupées par type${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  # Grouper par type
  curl -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" | jq '.sources | group_by(.type) | map({type: .[0].type, count: length, sources: map(.name)})'
fi
echo -e "\n"

# ============================================================================
# 9. Test avec verbose (voir les en-têtes de réponse)
# ============================================================================
echo -e "${BLUE}Test 9: Requête verbose (voir les en-têtes)${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -v -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN'"
echo -e ""
echo -e "${YELLOW}Résultat attendu: En-têtes de réponse + contenu${NC}"

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  curl -v -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN" 2>&1 | head -50
fi
echo -e "\n"

# ============================================================================
# 10. Test avec timing (mesurer la performance)
# ============================================================================
echo -e "${BLUE}Test 10: Mesurer la performance de la requête${NC}"
echo -e "${YELLOW}Commande:${NC}"
echo "curl -w '@curl-timing.txt' -o /dev/null -s -X GET '$API_URL$ENDPOINT' -H 'Authorization: Bearer $AUTH_TOKEN'"
echo -e ""

# Créer un fichier de format curl pour le timing
if [ ! -f "curl-timing.txt" ]; then
  cat > curl-timing.txt << 'EOF'
    time_namelookup:  %{time_namelookup}
    time_connect:     %{time_connect}
    time_appconnect:  %{time_appconnect}
    time_pretransfer: %{time_pretransfer}
    time_redirect:    %{time_redirect}
    time_starttransfer: %{time_starttransfer}
    ──────────────────
    time_total:       %{time_total}
EOF
fi

if [ "$AUTH_TOKEN" != "YOUR_ADMIN_JWT_TOKEN_HERE" ]; then
  echo -e "${YELLOW}Résultat:${NC}"
  curl -w "@curl-timing.txt" -o /dev/null -s -X GET "$API_URL$ENDPOINT" \
    -H "Authorization: Bearer $AUTH_TOKEN"
  echo -e ""
fi
echo -e "\n"

# ============================================================================
# Exemples PowerShell (pour Windows)
# ============================================================================
echo -e "${BLUE}Exemples PowerShell (pour Windows)${NC}"
echo -e "${YELLOW}Si vous utilisez PowerShell, vous pouvez utiliser:${NC}"
echo ""
echo "# Test simple"
echo "Invoke-RestMethod -Uri '$API_URL$ENDPOINT' -Headers @{Authorization='Bearer $AUTH_TOKEN'}"
echo ""
echo "# Avec Invoke-WebRequest (pour voir les headers)"
echo "Invoke-WebRequest -Uri '$API_URL$ENDPOINT' -Headers @{Authorization='Bearer $AUTH_TOKEN'} -Verbose"
echo ""
echo "# Exporter en JSON"
echo "\$result = Invoke-RestMethod -Uri '$API_URL$ENDPOINT' -Headers @{Authorization='Bearer $AUTH_TOKEN'}"
echo "\$result | ConvertTo-Json | Out-File -FilePath 'response.json'"
echo -e "\n"

# ============================================================================
# Information de débogage
# ============================================================================
echo -e "${GREEN}Informations de débogage:${NC}"
echo "- URL: $API_URL$ENDPOINT"
echo "- Méthode: GET"
echo "- Authentification: Bearer Token"
echo "- En-têtes recommandés:"
echo "  - Authorization: Bearer YOUR_TOKEN"
echo "  - Content-Type: application/json"
echo ""
echo -e "${YELLOW}Notes:${NC}"
echo "- Remplacez AUTH_TOKEN par votre token JWT réel"
echo "- Assurez-vous que le serveur s'exécute sur http://localhost:3000"
echo "- Utilisez jq pour formater et filtrer les résultats JSON"
echo "- Pour Windows, utilisez les exemples PowerShell fournis ci-dessus"
