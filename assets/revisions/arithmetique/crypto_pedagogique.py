"""Corrigés pédagogiques du support BUT2 S3 (pas une bibliothèque de production).

Les fonctions sont écrites pour être lisibles. Les petits RSA, César, Hill,
ElGamal et Merkle–Hellman servent uniquement aux exercices du cours.
Les fichiers originaux de l'étudiant sont conservés sans modification.
"""
from math import gcd, isqrt, prod
from itertools import product
import secrets


def eratosthene(n):
    """Liste des premiers <= n ; n<2 donne une liste vide."""
    if n < 2:
        return []
    premier = [True] * (n + 1)
    premier[0] = premier[1] = False
    for p in range(2, isqrt(n) + 1):
        if premier[p]:
            for multiple in range(p * p, n + 1, p):
                premier[multiple] = False
    return [p for p in range(2, n + 1) if premier[p]]


def isprime(n):
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    return all(n % d for d in range(3, isqrt(n) + 1, 2))


def euclide_etendu(a, b):
    """Renvoie (d,u,v) avec d>=0 et a*u+b*v=d."""
    aa, bb = abs(a), abs(b)
    u, v, up, vp = 1, 0, 0, 1
    while bb:
        q = aa // bb
        aa, bb = bb, aa % bb
        u, up = up, u - q * up
        v, vp = vp, v - q * vp
    return aa, u if a >= 0 else -u, v if b >= 0 else -v


def inverse_modn(a, n):
    if n < 2:
        raise ValueError('Le modulo doit être au moins 2.')
    d, u, _ = euclide_etendu(a % n, n)
    if d != 1:
        raise ValueError('Pas d’inverse : PGCD(a,n) != 1.')
    return u % n


def exponentiation(a, e, n):
    if e < 0 or n < 2:
        raise ValueError('Exposant >=0 et modulo >=2 requis.')
    resultat = 1
    a %= n
    while e:
        if e % 2:
            resultat = resultat * a % n
        a = a * a % n
        e //= 2
    return resultat


def diophantienne(a, b, c):
    """(x0,y0,dx,dy) : toutes les solutions (x0+dx*t,y0+dy*t).

    Cas a=b=0 exclu de cette présentation : deux inconnues libres si c=0.
    """
    if a == b == 0:
        raise ValueError('Cas dégénéré : traiter séparément 0=c.')
    d, u, v = euclide_etendu(a, b)
    if c % d:
        return None
    return u * (c // d), v * (c // d), b // d, -a // d


def cesar(data, k):
    """Entrée/sortie bytes ; pour déchiffrer, utiliser -k."""
    return bytes((x + k) % 256 for x in data)


def affine(data, a, b, dechiffrer=False):
    inverse = inverse_modn(a, 256)
    return bytes((inverse * (x - b) if dechiffrer else a*x+b) % 256
                 for x in data)


def inverse_matrice(M, n):
    (a,b), (c,d) = M
    invdet = inverse_modn(a*d-b*c, n)
    return [[d*invdet % n, -b*invdet % n],
            [-c*invdet % n, a*invdet % n]]


def chiffre_hill(M, X, n):
    if len(X) % 2:
        raise ValueError('Nombre pair de symboles requis ; définir un remplissage sinon.')
    Y = []
    for i in range(0, len(X), 2):
        x, y = X[i:i+2]
        Y.extend([(M[0][0]*x+M[0][1]*y) % n,
                  (M[1][0]*x+M[1][1]*y) % n])
    return Y


def restes_chinois(restes, modulos):
    """Cas deux à deux premiers entre eux ; renvoie (solution,période)."""
    if not restes or len(restes) != len(modulos):
        raise ValueError('Listes non vides de même longueur requises.')
    for i, m in enumerate(modulos):
        if m < 2 or any(gcd(m,n) != 1 for n in modulos[:i]):
            raise ValueError('Modulos >=2 et deux à deux premiers entre eux requis.')
    N = prod(modulos)
    x = sum(a*(N//m)*inverse_modn(N//m,m) for a,m in zip(restes,modulos))
    return x % N, N


def phi(n):
    if n < 1:
        raise ValueError('Entier positif requis.')
    resultat, restant, p = n, n, 2
    while p*p <= restant:
        if restant % p == 0:
            resultat -= resultat // p
            while restant % p == 0:
                restant //= p
        p += 1
    if restant > 1:
        resultat -= resultat // restant
    return resultat


def ordre(a, n):
    if gcd(a, n) != 1:
        raise ValueError('Une unité est requise.')
    x = 1
    for k in range(1, phi(n) + 1):
        x = x*a % n
        if x == 1:
            return k


def diffie_hellman(p, g, A, B):
    C, D = pow(g,A,p), pow(g,B,p)
    return C, D, pow(D,A,p), pow(C,B,p)


def elgamal(p, a, s, M, k):
    """Exemple numérique ; paramètres supposés correctement choisis."""
    Q = pow(a,s,p)
    C1 = pow(a,k,p)
    masque = pow(Q,k,p)
    C2 = M*masque % p
    clair = C2*inverse_modn(pow(C1,s,p),p) % p
    return {'Q':Q, 'C1':C1, 'masque':masque, 'C2':C2, 'clair':clair}


def genere_clef_rsa(p, q, e):
    """Petites valeurs : test exact par divisions (pas pour grands premiers)."""
    if p == q or not isprime(p) or not isprime(q):
        raise ValueError('Deux premiers distincts sont requis.')
    return (p*q,e), inverse_modn(e,(p-1)*(q-1))


def chiffre_rsa(m, clef_publique):
    n, e = clef_publique
    if not 0 <= m < n:
        raise ValueError('Le message doit être dans [0,n[.')
    return pow(m,e,n)


def dechiffre_rsa(c, clef_publique, d):
    return pow(c,d,clef_publique[0])


def fermat(n, a):
    if n in (2,3):
        return True
    if n < 2 or n % 2 == 0:
        return False
    if not 1 <= a < n:
        raise ValueError('Base dans [1,n[ requise.')
    return gcd(a,n) == 1 and pow(a,n-1,n) == 1


def miller_rabin_base(n, a):
    d, s = n-1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    x = pow(a,d,n)
    if x in (1,n-1):
        return True
    for _ in range(s-1):
        x = x*x % n
        if x == n-1:
            return True
    return False


def probablement_premier(n, tours=32):
    if tours < 1:
        raise ValueError('Au moins un tour requis.')
    if n in (2,3):
        return True
    if n < 2 or n % 2 == 0:
        return False
    for p in (3,5,7,11,13,17,19,23,29,31,37):
        if n == p:
            return True
        if n % p == 0:
            return False
    return all(miller_rabin_base(n, secrets.randbelow(n-3)+2)
               for _ in range(tours))


def genere_nbre_indus(k, tours=32):
    if k < 2:
        raise ValueError('Au moins deux bits requis.')
    while True:
        candidat = secrets.randbits(k) | (1 << (k-1)) | 1
        if probablement_premier(candidat,tours):
            return candidat


def rsa_blocs_demo(message):
    """TP : blocs de 256 bits ; n>2**256. Aucune sécurité de production."""
    while True:
        p, q = genere_nbre_indus(130), genere_nbre_indus(130)
        if p != q and gcd(7,(p-1)*(q-1)) == 1:
            break
    n, e = p*q, 7
    d = inverse_modn(e,(p-1)*(q-1))
    data = message.encode('utf-8')
    blocs = [data[i:i+32] for i in range(0,len(data),32)]
    chiffres = [(pow(int.from_bytes(b,'big'),e,n),len(b)) for b in blocs]
    clair = b''.join(pow(c,d,n).to_bytes(taille,'big') for c,taille in chiffres)
    assert n > 2**256
    return clair.decode('utf-8'), n.bit_length(), len(blocs)


def sac_a_dos_exhaustif(poids, cible):
    return [bits for bits in product((0,1),repeat=len(poids))
            if sum(b*w for b,w in zip(bits,poids)) == cible]


def supercroissante(w):
    total = 0
    for x in w:
        if x <= total:
            return False
        total += x
    return bool(w)


def sac_a_dos_glouton(w, cible):
    if not supercroissante(w) or cible < 0:
        raise ValueError('Suite supercroissante positive et cible >=0 requises.')
    bits = [0]*len(w)
    for i in range(len(w)-1,-1,-1):
        if cible >= w[i]:
            bits[i] = 1
            cible -= w[i]
    return bits if cible == 0 else None


def merkle_hellman(w, N, A, bits):
    if not supercroissante(w) or N <= sum(w) or gcd(A,N) != 1:
        raise ValueError('Conditions de la clé privée non vérifiées.')
    if len(bits) != len(w) or any(b not in (0,1) for b in bits):
        raise ValueError('Un bit par poids requis.')
    z = [A*x % N for x in w]
    Z = sum(b*x for b,x in zip(bits,z))
    W = inverse_modn(A,N)*Z % N
    return z, Z, W, sac_a_dos_glouton(w,W)


if __name__ == '__main__':
    print('Euclide 432,77 :', euclide_etendu(432,77))
    print('Inverse 235 modulo 367 :', inverse_modn(235,367))
    print('ElGamal p.60 :', elgamal(661,23,7,192,13))
    print('RSA blocs :', rsa_blocs_demo('Un cours expliqué, sans perdre les accents.\x00'))
    print('Sac à dos p.77 :', sac_a_dos_exhaustif([54,27,71,56,16],149))
