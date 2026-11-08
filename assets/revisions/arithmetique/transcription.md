# Transcription — Arithmétique pour la cryptographie

Voix de synthèse : fr-FR-VivienneMultilingualNeural. Sous-titres alignés sur les phrases du service vocal ; découpage des groupes de mots estimé.

## Comprendre le langage du cours


### Pourquoi des mathématiques pour chiffrer ?

Imagine que tu veux transmettre un message à quelqu’un qui connaît la bonne clé, alors qu’un observateur voit tout ce qui passe sur le réseau. Chiffrer, c’est transformer le message pour protéger sa confidentialité, c’est-à-dire empêcher un lecteur non autorisé d’en comprendre le contenu. Déchiffrer, c’est retrouver le message avec la clé prévue. Ce n’est pas la même chose que décoder : un encodage, comme UTF-8, représente une information sans chercher à la garder secrète.

La cryptographie utilise des opérations faciles à exécuter, mais dont certaines opérations inverses semblent très coûteuses quand on ne possède pas une information particulière. Multiplier deux grands nombres premiers est facile ; retrouver ces facteurs à partir de leur produit est une autre tâche. Le mot « semble » compte : on parle d’hypothèses de difficulté, pas d’une preuve que toute attaque est impossible.

Le principe de Kerckhoffs, dans ton support, dit que la confidentialité doit reposer sur la clé et non sur le secret de l’algorithme. On peut donc publier la méthode. Il faut néanmoins vérifier à qui appartient une clé publique : un attaquant qui remplace la clé du destinataire peut tromper un expéditeur. Chiffrement, intégrité des données et authentification des personnes sont des objectifs distincts. Les exemples numériques de ce cours servent à comprendre les mécanismes ; leurs petites valeurs ne protègent pas un vrai échange.


### Ensembles, fonctions et bijections : les rappels utiles

Quand on écrit que x appartient à l’ensemble des entiers relatifs, cela veut dire que x peut être négatif, nul ou positif, mais pas égal à une fraction non entière. Les accolades servent à décrire un ensemble ; le symbole « appartient » indique qu’un objet est l’un de ses éléments. Le symbole « pour tout » annonce que la propriété vaut pour chaque élément du domaine. « Il existe » demande au contraire au moins un exemple. « Si et seulement si » signifie que les deux implications sont vraies.

Une fonction f de E vers F associe à chaque élément x de l’ensemble de départ E un unique élément f de x dans l’ensemble d’arrivée F. L’image est le résultat ; un antécédent est une entrée qui donne ce résultat. Une fonction est injective si deux entrées différentes n’ont jamais la même image. Elle est surjective si chaque élément de F est atteint. Elle est bijective si elle possède ces deux propriétés : chaque résultat possible correspond alors à une seule entrée.

Pourquoi rappeler cela ? Pour déchiffrer sans ambiguïté, la transformation doit permettre de retrouver une entrée unique dans l’espace de messages retenu. Sur les restes modulo huit, multiplier par trois est bijectif : les huit entrées donnent huit résultats distincts. Multiplier par deux ne l’est pas : zéro et quatre donnent tous deux zéro. Une information a été perdue. La réciproque d’une bijection est la fonction qui revient du résultat à l’entrée ; son exposant moins un est une notation de fonction inverse, pas nécessairement une fraction.


### Puissances, racines et logarithmes : les outils avant les formules

Une puissance à exposant entier positif répète une multiplication. Deux puissance trois signifie deux fois deux fois deux, soit huit ; cela ne signifie pas deux fois trois. Pour une base non nulle, la puissance zéro vaut un, ce qui permet de conserver la règle a puissance r fois a puissance s égale a puissance r plus s. Le carré correspond à l’exposant deux ; le cube à l’exposant trois. Une puissance négative, dans les réels pour une base non nulle, est une puissance de l’inverse. Dans un anneau modulaire, cette écriture demande au contraire de vérifier que l’inverse existe.

La racine carrée positive de N est le nombre positif ou nul dont le carré vaut N. Pour cent, elle vaut dix. Pour quatre-vingt-dix-sept, elle se trouve entre neuf et dix parce que neuf au carré vaut quatre-vingt-un et dix au carré cent. Une racine entière inférieure, utilisée dans le programme de primalité, vaut ici neuf. Il ne faut pas confondre une racine carrée et une division par deux.

Un logarithme répond à la question inverse d’une puissance : à quel exposant faut-il élever une base pour obtenir une valeur positive ? Le logarithme en base deux de huit vaut trois car deux puissance trois vaut huit. Il mesure donc aussi combien de divisions par deux ramènent cette puissance à un. Le logarithme naturel, noté ln, est le logarithme en base e, une constante d’environ deux virgule sept cent dix-huit. Dans la formule de raréfaction, il augmente lentement avec N. Pour une base fixée supérieure à un, un changement de base multiplie le logarithme par une constante ; cela ne change pas sa classe grand O. Le logarithme discret que nous verrons plus tard est un autre problème, dans un groupe fini.

Le grand sigma désigne une somme : on additionne les termes indiqués par l’indice. Le grand pi désigne un produit : on les multiplie. Un indice i sert à numéroter les termes, pas à multiplier automatiquement par i. La fonction pi de N qui compte les premiers est encore une notation différente du nombre pi de la géométrie. Enfin un bit vaut zéro ou un ; un octet regroupe huit bits et représente deux puissance huit, soit deux cent cinquante-six valeurs possibles, numérotées de zéro à deux cent cinquante-cinq.


## Complexité et difficulté des problèmes


### La taille des données change tout

La complexité permet de comparer la quantité de travail d’un algorithme quand ses données grossissent. Une opération élémentaire est une action que l’on décide de compter : comparaison, affectation, addition, par exemple. La complexité en temps mesure le travail ; la complexité en espace mesure la mémoire. Elles ne sont pas identiques : conserver une immense table peut accélérer une recherche, mais coûter une mémoire impossible à fournir.

La notation grand O donne une borne de croissance à partir d’une certaine taille. Formellement, il existe une constante positive c et un seuil n zéro au-delà duquel T de n est au plus c fois f de n. Pour douze n plus cinq, le terme linéaire finit par dominer. Pour quatre n carré plus deux n plus six, c’est le carré. On retient souvent une borne informative, ici O de n et O de n carré, même si des bornes plus grandes seraient aussi vraies. Ce n’est pas une durée exacte et cela ne compare pas automatiquement deux programmes sur de petites entrées.

En cryptographie, surveille surtout la taille choisie. Le nombre N et le nombre de bits nécessaires pour l’écrire sont très différents. Un entier de k bits est de l’ordre de deux puissance k. Tester les diviseurs jusqu’à racine de N prend donc de l’ordre de deux puissance k sur deux essais : cela croît exponentiellement en k. Une boucle qui paraît modérée dans la valeur numérique peut être très coûteuse dans la taille réelle de l’entrée.


### Boucles, puissances et classes de problèmes

Pour compter une boucle, repère combien de fois elle s’exécute et le coût de son corps. Parcourir n cases avec un travail constant par case donne une croissance linéaire. Deux boucles imbriquées qui parcourent chacune n valeurs donnent un carré. Diviser une quantité par deux jusqu’à atteindre un donne environ logarithme de n itérations. C’est le mécanisme de l’exponentiation rapide que nous verrons plus loin. Les opérations sur de très grands entiers ont elles-mêmes un coût : dire qu’une multiplication est constante est une simplification de modèle.

La classe P regroupe les problèmes de décision résolus en temps polynomial par un algorithme déterministe. Un problème de décision appelle une réponse oui ou non. NP regroupe ceux pour lesquels une réponse positive peut être justifiée par un certificat vérifiable en temps polynomial. NP ne signifie pas « non polynomial ». On sait que P est incluse dans NP ; on ne sait pas si les deux classes sont égales. Une inclusion ne doit donc pas être présentée comme strictement démontrée ici.

PSPACE porte sur une mémoire polynomialement bornée. EXP porte sur un temps exponentiellement borné. Être dans une classe donne une borne de ressources ; cela ne prouve pas que tous ses problèmes exigent ce coût. Un problème NP-complet est dans NP et au moins aussi difficile que tous les problèmes de NP via les réductions appropriées. Cela ne rend pas automatiquement difficile chaque instance concrète.

Une fonction à sens unique est supposée facile à calculer et difficile à inverser sur les instances pertinentes. Une trappe rend le retour accessible à qui possède une information secrète. Il ne faut pas confondre une illustration de ce principe avec une preuve générale de sécurité d’un système.


### Passer d’un nombre d’opérations à une durée

Une estimation de durée utilise un modèle, pas seulement une classe grand O. Si on suppose exactement k carré opérations et un milliard d’opérations par seconde, avec k égal deux cents, il faut quarante mille opérations : en divisant par un milliard, on trouve quarante microsecondes. Une microseconde est un millionième de seconde. Avec k cube, on obtient huit millions d’opérations, soit huit millisecondes ; une milliseconde est un millième de seconde. Ces valeurs supposent que chaque opération a le coût retenu et que la machine réalise réellement ce débit.

Avec k puissance six, deux cents puissance six vaut soixante-quatre mille milliards d’opérations. Au même débit, cela donne soixante-quatre mille secondes, environ dix-sept virgule huit heures. Ce calcul montre pourquoi un polynôme de degré élevé peut coûter très cher. Les durées numériques du support sont illustratives : il ne faut pas les transformer en temps universels de multiplication, de PGCD ou de primalité, qui dépendent de l’algorithme, de la représentation et de la machine. Le calcul exact k puissance six pour k égal deux cents ne donne notamment pas trente-deux mille milliards.

Une factorielle, notée N point d’exclamation, est le produit de tous les entiers de un jusqu’à N. Cinq factorielle vaut un fois deux fois trois fois quatre fois cinq, soit cent vingt. La taille même du résultat grandit très vite. Un algorithme qui utilise un nombre polynomial d’opérations dans la valeur N ne devient pas pour autant polynomial dans le nombre de bits qui représentent N. Si N est de l’ordre de deux puissance k, parcourir tous les entiers de un à N demande déjà un nombre exponentiel d’itérations en k. C’est cette distinction qui rend cohérentes les discussions du support sur la factorielle.

Enfin, la mémoire se calcule avec ses unités : stocker un million d’entiers sur trente-deux octets demande au moins trente-deux millions d’octets, avant les coûts d’une liste ou des objets d’un langage. Un compromis temps-mémoire consiste à conserver des résultats pour éviter de les recalculer. Cela peut aider sur une petite borne, mais stocker tous les premiers cryptographiques ne devient pas réaliste. Définir la taille d’entrée, l’unité de travail et la représentation est donc la première étape d’une comparaison sérieuse.


## Divisibilité, nombres premiers et factorisation


### Diviser exactement ou garder un reste

Dire que b divise a signifie qu’il existe un entier q tel que a soit égal à b fois q. Le nombre a est alors un multiple de b. Lis bien le sens : trois divise douze parce que douze égale trois fois quatre. Douze ne divise pas trois. La barre ne représente pas une fraction ; c’est une relation de divisibilité.

Lorsque la division n’est pas exacte, la division euclidienne sépare le quotient et le reste. Avec un diviseur b strictement positif, on écrit a égal b fois q plus r, où r est compris entre zéro inclus et b exclu. Pour dix-sept divisé par cinq, q vaut trois et r vaut deux. Pour moins dix-sept, le quotient vaut moins quatre et le reste trois : cinq fois moins quatre plus trois redonne bien moins dix-sept. Un reste euclidien n’est donc pas forcément le résultat d’une troncature vers zéro.

Pourquoi le reste est-il unique ? Si deux écritures respectaient ces bornes, leur différence donnerait un multiple de b strictement compris entre moins b et b. Le seul multiple possible serait zéro ; les restes, puis les quotients, seraient égaux. En Python, avec b positif, double barre calcule le quotient entier et pour cent calcule le reste. Tu peux vérifier l’identité en recomposant b fois q plus r.

Si d divise deux entiers a et b, il divise toute combinaison entière de ces nombres : a plus b, a moins b, mais aussi u fois a plus v fois b. Écris a égal d fois s et b égal d fois t : la combinaison contient alors d en facteur. Cette observation apparemment simple justifie l’algorithme d’Euclide et le théorème de Bézout.


### Pourquoi s’arrêter à la racine carrée ?

Un entier premier est un entier au moins égal à deux dont les seuls diviseurs positifs sont un et lui-même. Un n’est pas premier ; zéro et les entiers négatifs ne sont pas premiers dans cette convention. Un entier supérieur à un qui n’est pas premier est composé. « Premiers entre eux », que nous utiliserons ensuite, est une autre expression : huit et neuf sont premiers entre eux sans être des nombres premiers.

Pour tester un petit entier N, on cherche un diviseur. Si N est égal à a fois b et que a et b étaient tous les deux strictement supérieurs à la racine carrée de N, leur produit dépasserait N. Au moins un diviseur d’un nombre composé est donc inférieur ou égal à cette racine. Après avoir éliminé deux et les nombres pairs, on peut tester seulement trois, cinq, sept et ainsi de suite jusqu’à cette borne. Pour quatre-vingt-onze, sept est trouvé et suffit à prouver que le nombre est composé. Pour quatre-vingt-dix-sept, les essais trois, cinq, sept et neuf ne trouvent rien : c’est premier.

Ton fichier 2isprime.py applique cette méthode. Pour un entier très grand, utiliser une racine entière, par exemple math.isqrt, évite les imprécisions d’un calcul en flottants. En revanche, même une racine entière exacte ne supprime pas le coût d’une immense quantité de divisions. Cette méthode est adaptée à l’apprentissage et aux petites valeurs.

Le support p.19 affirme trop largement l’absence d’algorithme déterministe acceptable ; sa p.70 mentionne justement AKS, qui est polynomial. Il faut distinguer l’existence théorique d’un algorithme et les méthodes les plus pratiques pour les tailles cryptographiques.


### Le crible, la décomposition et la raréfaction

Le crible d’Ératosthène cherche tous les nombres premiers jusqu’à une borne. On commence par considérer tous les entiers à partir de deux comme candidats. Deux est le premier candidat : on conserve deux et on barre ses multiples. Le premier candidat non barré suivant est trois ; on barre ses multiples, puis ceux de cinq, et ainsi de suite. On peut commencer à p carré : les multiples plus petits ont déjà un facteur premier plus petit et ont été traités. Il suffit de poursuivre tant que p carré ne dépasse pas la borne.

Dans ton fichier 1eratosthene.py, la variable T reçoit L sans copie. Les deux noms désignent la même liste, et retirer un élément pendant qu’on la parcourt peut faire sauter l’élément suivant. Cela peut laisser des composés parmi les résultats. Une table de booléens, indexée par les entiers, évite cette difficulté et rend le mécanisme du crible plus clair. La correction proposée sera séparée de ton original.

Tout entier supérieur à un possède une décomposition en facteurs premiers, unique à l’ordre des facteurs près. Les exposants indiquent combien de fois le même facteur apparaît. Ainsi soixante contient deux fois le facteur deux, une fois trois et une fois cinq. Cette décomposition donne accès au PGCD, au PPCM et à la fonction d’Euler.

La fonction pi de N compte les nombres premiers inférieurs ou égaux à N. Le théorème des nombres premiers dit que son rapport à N divisé par logarithme naturel de N tend vers un. Il décrit une tendance à grande échelle, pas le placement exact du prochain premier. Près d’un entier de k bits, la proportion de premiers est approximativement un sur k fois logarithme de deux ; parmi les candidats impairs, elle est environ deux fois plus grande. Pour deux cent cinquante-six bits, ces ordres de grandeur sont environ zéro virgule cinquante-six pour cent, puis un virgule treize pour cent. Préparer tous les premiers jusqu’à deux puissance deux cent cinquante-six serait irréaliste : on les cherche à la demande.


## PGCD, PPCM, Euclide et Bézout


### Ce que mesurent le PGCD et le PPCM

Le plus grand commun diviseur de deux entiers non tous deux nuls est leur plus grand diviseur positif commun. Le plus petit commun multiple de deux entiers non nuls est leur plus petit multiple positif commun. Le PGCD répond à une question de découpage maximal identique ; le PPCM répond à une question de première coïncidence de périodes. Le signe n’affecte pas ces nombres positifs : on utilise les valeurs absolues.

Avec soixante et cent soixante-huit, les décompositions sont deux carré fois trois fois cinq et deux cube fois trois fois sept. Pour le PGCD, on garde les facteurs présents dans les deux nombres avec le plus petit exposant : deux carré fois trois donne douze. Pour le PPCM, on garde tous les facteurs avec le plus grand exposant : deux cube fois trois fois cinq fois sept donne huit cent quarante. Le produit douze fois huit cent quarante vaut bien le produit des deux nombres.

Pourquoi Euclide fonctionne-t-il sans factorisation ? Si a égale b fois q plus r, un diviseur commun de a et b divise aussi r, puisque r égale a moins b fois q. Réciproquement, un diviseur commun de b et r divise a, puisque a égale b fois q plus r. Les deux couples ont exactement les mêmes diviseurs communs ; leurs PGCD sont donc égaux.

Dans le support p.22, une propriété est écrite sous une forme qui n’est pas vraie pour tout k. La propriété sûre à retenir est : le PGCD de a et b ne change pas quand on remplace a par a plus un multiple entier de b. Cela correspond exactement à la justification que nous venons de donner.


### Dérouler Euclide sans apprendre une recette aveugle

Prenons l’exemple du support : deux cent quatre et cent soixante-huit. La première division donne un quotient un et un reste trente-six. Le PGCD recherché est donc aussi celui de cent soixante-huit et trente-six. La division suivante donne un reste vingt-quatre. Puis trente-six divisé par vingt-quatre donne douze. Enfin vingt-quatre est un multiple exact de douze : le reste devient zéro.

On retourne le dernier reste non nul, ici douze. Pourquoi pas zéro ? Parce que l’algorithme termine avec le couple douze et zéro ; tout entier divise zéro, donc le plus grand diviseur commun positif est celui de douze. À chaque étape, le nouveau reste est plus petit que le diviseur précédent et reste positif ou nul. Une suite strictement décroissante d’entiers positifs ne peut pas continuer indéfiniment : cela prouve la terminaison.

En Python, conserver les deux anciennes valeurs est essentiel. L’affectation simultanée a, b égal b, a modulo b calcule le côté droit avant de remplacer les variables. Avec des affectations séparées maladroites, on pourrait écraser a avant d’avoir calculé le reste. Pour accepter les entrées négatives, on commence par les valeurs absolues. Si b est déjà nul, aucune division n’est nécessaire.

Deux entiers sont premiers entre eux si ce PGCD vaut un. Cela n’impose pas qu’ils soient premiers séparément : quatorze et quinze n’ont aucun facteur commun supérieur à un. Ce critère va décider si une division modulaire est possible. L’exercice du support sur deux mille trente-sept et cinq mille trente-six se résout avec le même algorithme ; le PGCD vaut un.


### Bézout : retrouver les coefficients utiles

L’identité de Bézout ajoute une information au PGCD : il existe des entiers u et v tels que a fois u plus b fois v soit égal au PGCD. Les coefficients peuvent être négatifs ; ils ne sont pas uniques. Si le PGCD vaut un, cette combinaison vaut un. Réciproquement, si une combinaison entière de a et b vaut un, tout diviseur commun doit diviser un ; le PGCD vaut donc un. C’est la preuve des deux sens du critère « premiers entre eux ».

Pour deux cent trente-quatre et trente-cinq, Euclide produit les restes vingt-quatre, onze, deux et un. Remontons : un égale onze moins cinq fois deux. Comme deux égale vingt-quatre moins deux fois onze, cela donne onze fois onze moins cinq fois vingt-quatre. Remplaçons onze par trente-cinq moins vingt-quatre : on obtient onze fois trente-cinq moins seize fois vingt-quatre. Enfin vingt-quatre égale deux cent trente-quatre moins six fois trente-cinq. Le résultat est moins seize fois deux cent trente-quatre plus cent sept fois trente-cinq. Vérification : moins trois mille sept cent quarante-quatre plus trois mille sept cent quarante-cinq vaut bien un.

L’algorithme étendu automatise cette remontée. Il transporte deux coefficients pour chaque reste. L’invariant, c’est la propriété qui reste vraie à chaque tour : chaque reste est une combinaison des deux entrées initiales. Quand on soustrait q fois le second reste au premier, on fait exactement la même opération sur leurs coefficients. Ton fichier 3euclide_etendu.py suit ce principe pour des entrées positives. Le rôle de u et v devient ainsi compréhensible, plutôt qu’une suite de variables à mémoriser.


## Équations entières et théorème de Gauss


### Résoudre dans les entiers change le problème

Une équation diophantienne cherche des solutions entières. Cela change le problème : quatre x plus six y égal trois admet des solutions réelles, mais aucune solution entière. La partie gauche est toujours paire ; la partie droite est impaire. Plus généralement, si d est le PGCD de a et b, chaque combinaison a x plus b y est un multiple de d. Il faut donc que d divise c. Cette condition est également suffisante grâce à Bézout.

Si a u plus b v égale d et c égale d fois k, multiplier l’identité par k donne une première solution x zéro égal k u et y zéro égal k v. Ce n’est qu’une solution particulière. Pour trouver toutes les solutions, on compare une solution quelconque à celle-ci. La différence satisfait a fois x moins x zéro plus b fois y moins y zéro égal zéro. Après division par d, les coefficients a sur d et b sur d sont premiers entre eux. On en déduit que la variation de x est un multiple de b sur d, et celle de y le multiple opposé de a sur d.

Pour cinq x plus trois y égal sept, Bézout donne moins cinq plus deux fois trois égal un. En multipliant par sept : moins trente-cinq plus quarante-deux égale sept. Une solution est donc moins sept et quatorze. Toutes les solutions sont moins sept plus trois t, et quatorze moins cinq t, avec t entier. Pour t égal trois, on retrouve deux et moins un : dix moins trois vaut sept. Si l’énoncé impose ensuite x et y positifs, il faut ajouter ces inégalités et chercher les valeurs entières de t compatibles. Ne pas les supposer sans les lire.


### Gauss : quand peut-on simplifier une divisibilité ?

Le théorème de Gauss dit ceci : si a divise le produit b fois c et si a et b sont premiers entre eux, alors a divise c. L’hypothèse sur le PGCD est indispensable. Six divise deux fois trois, mais six ne divise pas trois : on ne peut donc pas supprimer un facteur au hasard dans une relation de divisibilité.

Pour comprendre la preuve, écris une identité de Bézout a u plus b v égale un. Multiplie-la par c : a c u plus b c v égale c. Le premier terme contient a. Le second est divisible par a parce que a divise b c. Leur somme c est donc divisible par a. La preuve réutilise simplement le fait qu’un diviseur commun divise les combinaisons entières.

Si un premier p divise b fois c, soit p divise b, soit p est premier avec b ; dans ce deuxième cas Gauss oblige p à diviser c. Voilà pourquoi les nombres premiers jouent le rôle de briques dans une factorisation.

Autre conséquence utile : si a et b sont premiers entre eux et divisent tous deux N, alors leur produit divise N. Sans cette hypothèse, il faut parler de PPCM. Par exemple quatre et six divisent douze, mais leur produit vingt-quatre ne le divise pas. Nous réutiliserons exactement cette distinction dans le théorème des restes chinois et dans la preuve de RSA. Pour bien choisir une méthode, demande-toi donc si tu connais une égalité entière, une divisibilité ou une congruence, puis repère où une condition de coprimalité permet une simplification.


## Congruences, classes et inverses modulaires


### Une horloge pour comprendre les congruences

Sur une horloge de douze heures, quinze heures et trois heures pointent la même graduation. Les entiers ne sont pas égaux, mais leur différence est un multiple de douze. C’est le sens d’une congruence. On écrit a congru à b modulo n si n divise a moins b. Le modulo n est le nombre de positions avant de revenir au point de départ. Le support p.32 inverse la barre dans une des formulations : c’est bien n qui divise la différence.

Modulo sept, quinze est congru à un car quinze moins un vaut quatorze. Trois est congru à moins onze car leur différence vaut aussi quatorze. Tous les nombres de la forme un plus sept fois k, avec k entier relatif, constituent une même classe. Cette classe contient moins treize, moins six, un, huit, quinze et ainsi de suite. Le représentant canonique est celui compris entre zéro et six, ici un. Il faut distinguer la classe infinie et son représentant pratique.

L’ensemble quotient, noté Z sur n Z, regroupe ces classes ; il en contient exactement n. On peut calculer avec les représentants zéro jusqu’à n moins un en réduisant le résultat après chaque opération. Deux plus six donne huit, donc un modulo sept. Deux fois six donne douze, donc cinq modulo sept.

Pourquoi est-ce légitime ? Si on remplace un nombre par lui-même plus un multiple de n, la somme ou le produit change encore d’un multiple de n. Le résultat appartient donc à la même classe. On peut ainsi réduire très tôt de gros calculs sans modifier le reste final. En revanche, une congruence n’autorise pas toutes les manipulations d’une égalité réelle, notamment la division.


### Groupes, anneaux, corps : à quoi servent ces mots ?

Une structure algébrique décrit les règles que respectent un ensemble et ses opérations. Ce vocabulaire te dit quelles manipulations sont permises. Une opération interne garde le résultat dans l’ensemble. L’associativité signifie que changer le regroupement de trois termes ne change pas le résultat. Un élément neutre laisse les autres éléments inchangés : zéro pour additionner, un pour multiplier. Un inverse permet de revenir au neutre. L’opposé de trois est moins trois pour l’addition ; son inverse multiplicatif est une autre question.

Un groupe possède une opération associative, un neutre et un inverse pour chaque élément. Si l’ordre des deux termes ne change pas le résultat, on dit qu’il est commutatif. Les classes modulo n forment un groupe commutatif pour l’addition : chaque classe a son opposé. Avec une multiplication distributive sur l’addition, on obtient un anneau. Distributive veut dire que a fois b plus c se développe en a b plus a c.

Un corps, dans la convention commutative utilisée ici, permet en plus d’inverser tout élément non nul pour la multiplication. Z modulo p est un corps lorsque p est premier. Attention à la p.39 du support : il ne faut pas retirer zéro pour définir ce corps. L’ensemble des seuls éléments inversibles, noté avec une étoile, est un groupe pour la multiplication, pas un corps avec les deux opérations. Modulo sept, six et un sont inversibles mais leur somme vaut zéro, qui sort de cet ensemble étoilé.

Modulo huit, deux fois quatre vaut zéro alors qu’aucun des deux facteurs n’est zéro dans l’anneau. On parle de diviseurs de zéro. Cela explique pourquoi simplifier une multiplication peut échouer. Le vocabulaire n’est donc pas un décor abstrait : il évite des calculs faux et annonce les conditions de déchiffrement.


### L’inverse modulaire est une identité de Bézout

L’inverse de a modulo n est un entier u dont le produit par a donne un reste égal à un. Ce n’est pas le nombre réel un divisé par a. Pour trois modulo sept, cinq convient car trois fois cinq vaut quinze, soit un plus deux fois sept. Pour trois modulo huit, trois convient car neuf laisse un reste un. Le même entier a peut donc avoir des inverses différents selon le modulo.

Si le PGCD de a et n vaut un, Bézout fournit a u plus n v égal un. En réduisant modulo n, le terme n v disparaît ; a u est congru à un. Réciproquement, si a u est congru à un, il existe un entier v qui complète l’identité ; tout diviseur commun de a et n divise un. Le critère est donc nécessaire et suffisant. L’inverse est unique comme classe modulo n, même si on peut lui ajouter n autant de fois qu’on veut.

Prenons l’exemple de ton support et de 4inversion_modn.py. Euclide étendu donne moins cent quatorze et soixante-treize pour deux cent trente-cinq et trois cent soixante-sept. Le premier coefficient donne un inverse négatif. On lui ajoute le modulo : moins cent quatorze plus trois cent soixante-sept vaut deux cent cinquante-trois. Vérification : deux cent trente-cinq fois deux cent cinquante-trois laisse le reste un.

Pour quatre modulo huit, le PGCD vaut quatre : aucun inverse. Tous les produits de quatre sont pairs et ne peuvent pas laisser un reste un modulo huit. « Diviser par a » dans une congruence signifie donc multiplier par son inverse, après avoir prouvé qu’il existe. Pour les entrées négatives, un programme doit normaliser a modulo n ; pour n au moins deux, Python pour cent donne un représentant positif ou nul, et non toujours strictement positif.


## César, affine et Hill : retrouver le message


### César et affine : vérifier que la transformation se renverse

Le chiffrement de César remplace chaque symbole par un autre après un décalage fixe. Sur vingt-six lettres, on peut numéroter A par zéro, B par un, et ainsi de suite. Avec une clé de trois, la lettre Z, numéro vingt-cinq, devient C, numéro deux, parce que vingt-huit laisse deux modulo vingt-six. Pour revenir, on soustrait trois. Additionner une constante est une bijection quel que soit le modulo : l’opposé du décalage annule toujours l’opération.

Ton support travaille sur des valeurs d’octets, de zéro à deux cent cinquante-cinq. Il parle d’ASCII sur huit bits, mais l’ASCII standard comporte cent vingt-huit codes. Pour les accents du message, il faut choisir explicitement un encodage. Nous utiliserons des octets UTF-8 : un caractère accentué peut occuper plusieurs octets ; le chiffrement s’applique à chaque octet, puis le déchiffrement restitue ces octets avant de décoder le texte. Cela évite de confondre caractère et nombre compris entre zéro et deux cent cinquante-cinq.

Le chiffrement affine multiplie d’abord par a puis ajoute b. Pour déchiffrer, on retire b puis on multiplie par l’inverse de a. Si cet inverse n’existe pas, la transformation peut fusionner plusieurs entrées et perdre de l’information. Modulo huit, six x plus sept congru à treize revient à six x congru à six ; les solutions sont un et cinq modulo huit. Cinq x plus sept congru à treize devient cinq x congru à six. Cinq est son propre inverse modulo huit ; on obtient x congru à trente, donc six.

Une attaque statistique de César compare les fréquences ou essaie toutes les clés. Un texte court ne garantit pas que la lettre la plus fréquente soit un espace ou un e. Pour un exercice, afficher et classer les deux cent cinquante-six décalages permet de discuter les limites au lieu d’annoncer une clé certaine.


### Matrices et Hill : expliquer chaque opération

Une matrice est un tableau de coefficients. Une matrice carrée de taille deux possède deux lignes et deux colonnes. Un vecteur colonne regroupe ici deux symboles du message. Pour multiplier la matrice par ce vecteur, on multiplie les coefficients de la première ligne par les deux composantes puis on additionne ; on recommence avec la deuxième ligne. Le résultat forme le vecteur chiffré. L’ordre des facteurs compte : une matrice et un vecteur ne s’échangent pas comme deux nombres.

Pour la matrice du support, première ligne quatre et trois, deuxième ligne cinq et un, le déterminant vaut quatre fois un moins trois fois cinq, soit moins onze. Modulo sept, cela donne trois. Le déterminant est un nombre associé à une matrice carrée ; ici son inversibilité décide si l’on peut inverser la matrice. Il ne suffit pas qu’il soit non nul lorsque le modulo est composé : il doit être premier avec le modulo. Une fois l’inverse du déterminant calculé, on échange les deux coefficients diagonaux et on change le signe des deux autres, puis on multiplie tout par cet inverse.

L’inverse de trois modulo sept vaut cinq. On obtient donc la matrice de lignes cinq, six, puis trois, six. Pour le bloc deux, trois, la première sortie vaut quatre fois deux plus trois fois trois, soit dix-sept, donc trois modulo sept. La seconde vaut cinq fois deux plus trois, soit treize, donc six. En appliquant la matrice inverse à trois, six, on retrouve deux, trois. Le bloc cinq, un donne deux, cinq. Les quatre symboles chiffrés sont donc trois, six, deux, cinq.

Le support parle de paquets de bits, mais l’opération de Hill regroupe ici des symboles, pas nécessairement des bits. Pour un nombre impair d’octets et des blocs de taille deux, il faut convenir d’un remplissage et conserver la longueur d’origine pour le retirer sans ambiguïté. Ton fichier Hill ne contient que la signature de fonction : la solution fournie sera un complément, pas un résultat de TP attribué à ton travail.


## Combiner plusieurs congruences


### Construire une solution : le restaurant du support

Plusieurs congruences peuvent décrire une même quantité. Dans l’exemple du restaurant, diviser le nombre de personnes par quatre laisse un reste trois ; le diviser par cinq laisse un reste deux. On cherche tous les entiers qui respectent les deux contraintes, pas un quotient ni un seul nombre deviné. En essayant les nombres trois, sept, onze, quinze et dix-neuf, sept fonctionne. Tous les vingt pas, les deux restes se répètent.

Le théorème des restes chinois affirme que si les modulos sont premiers entre eux, il existe une unique classe de solutions modulo leur produit. Pour construire cette classe, on fabrique deux interrupteurs mathématiques. Le premier doit valoir un modulo quatre et zéro modulo cinq. Cinq fois l’inverse de cinq modulo quatre convient : il vaut cinq. Le second doit valoir zéro modulo quatre et un modulo cinq. Quatre fois l’inverse de quatre modulo cinq convient : il vaut seize. Multiplier ces interrupteurs par les restes désirés, puis les additionner, donne trois fois cinq plus deux fois seize, soit quarante-sept. En réduisant modulo vingt, on trouve sept.

Vérification obligatoire : sept laisse trois modulo quatre et deux modulo cinq. Toutes les solutions entières s’écrivent sept plus vingt fois t, avec t entier. Si le nombre de personnes doit être positif, on garde les valeurs positives de cette famille. Si l’énoncé ne donne pas d’intervalle, on ne peut pas choisir un effectif unique. La construction explique aussi le théorème : chaque terme règle une contrainte et s’annule dans l’autre, donc les contraintes ne se perturbent pas.


### Plusieurs modulos et cas non premiers entre eux

Pour plus de deux congruences à modulos deux à deux premiers entre eux, on reprend les mêmes interrupteurs. Le produit de tous les modulos s’appelle M. Pour la contrainte numéro i, on prend M divisé par son modulo : ce nombre est multiple de tous les autres modulos. On le multiplie par son inverse dans le modulo manquant. Le terme obtenu vaut donc un pour cette contrainte et zéro pour toutes les autres. La somme pondérée par les restes donne la solution.

Dans l’exercice des pirates du support, les restes sont trois modulo dix-sept, quatre modulo onze et cinq modulo six. Le produit vaut mille cent vingt-deux. Les trois produits partiels sont soixante-six, cent deux et cent quatre-vingt-sept. Leurs inverses utiles sont huit, quatre et un. La somme vaut quatre mille cent cinquante et un ; son reste modulo mille cent vingt-deux est sept cent quatre-vingt-cinq. On vérifie les trois restes avant d’accepter la réponse. La plus petite valeur positive est donc sept cent quatre-vingt-cinq.

Si les modulos ne sont pas premiers entre eux, la formule précédente peut demander un inverse inexistant. Il faut d’abord vérifier la compatibilité : les deux restes doivent être congrus modulo le PGCD des modulos. Un modulo six et quatre modulo quinze sont compatibles car leur différence est trois, multiple du PGCD trois. La période commune est alors le PPCM, ici trente, et non le produit quatre-vingt-dix. En écrivant x égal un plus six k, la seconde contrainte devient six k congru à trois modulo quinze. Après division entière de l’équation par trois, deux k est congru à un modulo cinq ; k est donc congru à trois modulo cinq. On obtient x congru à dix-neuf modulo trente. Deux restes incompatibles donneraient au contraire aucune solution.


## Indicatrice d’Euler, petit théorème de Fermat et théorème d’Euler


### Compter les éléments que l’on peut inverser

La lettre grecque phi se lit fi. La fonction phi de n compte les entiers entre un et n moins un qui sont premiers avec n. Grâce au critère de l’inverse, elle compte exactement les éléments du groupe multiplicatif des unités modulo n. Pour huit, les éléments un, trois, cinq et sept sont premiers avec huit : phi de huit vaut quatre. Pour sept premier, tous les représentants non nuls conviennent : phi de sept vaut six.

Si p est premier, phi de p puissance k vaut p puissance k moins p puissance k moins un. Pour comprendre cette soustraction, comptons de zéro jusqu’à p puissance k moins un. Les seuls nombres non premiers avec p puissance k sont les multiples de p ; il y en a p puissance k moins un, zéro compris. On retire ces multiples du total. Par exemple, modulo neuf, on retire zéro, trois et six : il reste six unités.

La formule générale part de la décomposition en facteurs premiers et enlève la proportion des multiples de chaque premier distinct. Pour soixante, on calcule soixante fois un moins un demi, fois un moins un tiers, fois un moins un cinquième. Le résultat est seize. Chaque facteur premier est utilisé une seule fois, même s’il apparaît avec un exposant supérieur à un dans la décomposition. On ne multiplie pas deux fois par un demi pour le facteur deux carré.

Si deux entiers sont premiers entre eux, phi de leur produit est le produit de leurs phi. Pour deux premiers distincts p et q, on obtient p moins un fois q moins un. Le mot « distincts » compte : pour p carré, cette dernière formule serait fausse ; il faut utiliser p fois p moins un. RSA choisit justement deux premiers distincts.


### Utiliser un théorème de puissance avec ses hypothèses

Le théorème d’Euler affirme que si a est premier avec n, alors a élevé à phi de n vaut un modulo n. Son intérêt est de réduire certains calculs de puissances et de justifier des mécanismes cryptographiques. Il ne s’applique pas à n’importe quelle base : deux puissance quatre vaut zéro modulo huit, et non un. L’hypothèse sur le PGCD n’est donc pas un détail.

Voici une idée de preuve. Prends la liste de tous les éléments inversibles modulo n. Multiplier chacun par a réordonne cette liste sans perdre ni fusionner d’éléments, parce que a est lui-même inversible. Le produit de la liste multipliée est donc égal au produit de la liste initiale modulo n. Mais le premier produit contient a une fois pour chacun des phi de n éléments. Le produit des éléments de la liste est inversible ; on peut l’annuler des deux côtés. Il reste a puissance phi de n congru à un. Nous avons utilisé une bijection et une annulation autorisée, deux rappels désormais expliqués.

Si le modulo est un premier p, phi de p vaut p moins un. On retrouve la version multiplicative du petit théorème de Fermat pour une base non divisible par p. En multipliant par a, on obtient a puissance p congru à a ; cette dernière forme reste vraie quand p divise a, puisque les deux côtés valent alors zéro. Ne confonds pas ces deux versions.

Pour calculer trois puissance cent modulo sept, trois est premier avec sept et trois puissance six vaut un. Cent égale seize fois six plus quatre : la puissance se ramène à trois puissance quatre, dont le reste est quatre. Un exposant négatif demande d’abord une base inversible. Et réussir une égalité de Fermat ne prouve pas que le modulo est premier : nous étudierons les contre-exemples.


## Puissances rapides, ordre et logarithme discret


### Construire de grandes puissances sans les écrire

Calculer d’abord une puissance gigantesque puis prendre son reste gaspille du travail et de la mémoire. Les congruences nous autorisent à réduire après chaque multiplication. Une autre idée permet d’éviter de multiplier la base autant de fois que l’exposant : écrire cet exposant en binaire. Un nombre binaire utilise seulement zéro et un ; chaque position représente une puissance de deux. Cent cinquante-quatre se décompose en cent vingt-huit plus seize plus huit plus deux.

On calcule donc les puissances successives par carrés : la base, son carré, sa puissance quatre, sa puissance huit et ainsi de suite. Pour dix-sept modulo cent, les restes sont dix-sept, quatre-vingt-neuf, vingt et un, quarante et un, quatre-vingt-un, soixante et un, vingt et un, puis quarante et un pour les exposants un, deux, quatre, huit, seize, trente-deux, soixante-quatre et cent vingt-huit. Chaque étape demande un seul carré du reste précédent.

On conserve ensuite les termes qui correspondent aux bits égaux à un : exposants cent vingt-huit, seize, huit et deux. Leur produit modulo cent vaut vingt-neuf. On a remplacé une très longue répétition par un nombre de carrés proportionnel au nombre de bits de l’exposant.

L’algorithme garde un résultat initial égal à un. Si l’exposant courant est impair, il multiplie le résultat par la base courante. Il élève ensuite la base au carré et divise l’exposant par deux en quotient entier. L’invariant explique pourquoi cela marche : résultat fois base puissance exposant reste congru à la puissance initialement demandée. À la fin, l’exposant est zéro ; ce produit se réduit au résultat. Pour un modulo positif et un exposant nul, on retourne un modulo n. Python propose déjà pow avec trois arguments ; notre fonction pédagogique permet d’en comprendre le mécanisme.


### Ordre et racines primitives : des cycles de puissances

Quand on multiplie plusieurs fois par un élément inversible modulo n, les valeurs finissent par former un cycle qui revient à un. L’ordre multiplicatif de cet élément est le plus petit exposant strictement positif qui produit un. Le zéro de départ dans une table de puissances donne toujours un, mais il ne définit pas l’ordre : on cherche le premier retour après au moins une multiplication.

Modulo sept, deux donne successivement deux, quatre, puis un : son ordre est trois. Trois donne trois, deux, six, quatre, cinq, puis un : son ordre est six. Six donne six puis un : son ordre est deux. Pour un modulo premier p, l’ordre d’un élément non nul divise p moins un. Une racine primitive est un élément dont l’ordre atteint p moins un ; ses puissances parcourent alors toutes les classes non nulles. Modulo sept, trois et cinq sont des racines primitives.

Cette idée précise le domaine sur lequel la puissance devient bijective. Avec une racine primitive g modulo p, il faut prendre un seul représentant de chaque exposant modulo p moins un, par exemple de zéro à p moins deux. Les puissances correspondantes parcourent une fois chacune les classes non nulles modulo p. Si tu inclus aussi l’exposant p moins un, tu retrouves un une seconde fois ; il n’y a plus unicité sur cet ensemble trop grand. C’est une correction importante de la présentation de la p.56 du support.

L’ordre concerne donc une base donnée, pas seulement le modulo. Pour choisir des paramètres d’échange de clé, on ne peut pas supposer qu’une base quelconque parcourt tout le groupe. En pratique on peut aussi travailler dans un sous-groupe choisi ; ici nous restons sur les groupes petits et explicites du cours.


### Le logarithme discret : retrouver l’exposant

Un logarithme discret cherche l’exposant qui produit une valeur donnée modulo un entier. Le mot discret indique que l’on travaille sur des ensembles d’entiers ou des groupes finis, pas sur une courbe continue comme le logarithme réel. On ne calcule pas ce logarithme en divisant deux logarithmes sur une calculatrice : la réduction modulo a changé le problème.

Dans la table des puissances de cinq modulo sept, les exposants zéro, un, deux, trois, quatre et cinq donnent respectivement un, cinq, quatre, six, deux et trois. Pour obtenir six, il faut donc l’exposant trois dans cette plage. Si on ajoute six à cet exposant, les puissances recommencent le même cycle. La réponse générale est trois modulo six, et non trois modulo sept. Pour trois puissance k congru à quatre modulo sept, on trouve de même k égal quatre modulo six.

Sur de petits paramètres, on peut chercher dans la table. Pour de grands groupes bien choisis, calculer la puissance reste rapide grâce à l’exponentiation binaire, tandis que retrouver l’exposant peut être difficile avec les algorithmes classiques connus. L’appartenance à une classe de complexité, à elle seule, ne démontre pas cette difficulté. On ne doit donc pas écrire « c’est NP, donc c’est difficile » comme une preuve. La difficulté dépend aussi du choix du groupe et des paramètres.

Ce contraste permet à Alice et Bob de calculer une information partagée sans publier leurs exposants secrets. Il ne suffit toutefois pas d’affirmer qu’un problème de logarithme discret paraît difficile pour avoir prouvé la sécurité de toutes les variantes de tous les protocoles. On doit examiner exactement ce que l’adversaire voit, ce qu’il cherche et les hypothèses du système. Dans le prochain exemple, nous vérifierons d’abord l’égalité mathématique qui donne la même clé aux deux participants.


## Diffie–Hellman et ElGamal


### Pourquoi Alice et Bob obtiennent-ils la même clé ?

Diffie–Hellman est un échange permettant de calculer une même valeur secrète à partir de paramètres publics et de secrets individuels. Il ne chiffre pas directement le texte du message. Le modulo p et la base g sont publics. Alice choisit son exposant secret A et publie g puissance A modulo p. Bob choisit son exposant secret B et publie g puissance B modulo p. Les exposants eux-mêmes ne traversent pas le réseau.

Alice élève la valeur reçue de Bob à son exposant A. Elle obtient g puissance B, le tout à la puissance A, soit g puissance A fois B modulo p. Bob élève la valeur reçue d’Alice à son exposant B et obtient g puissance A fois B également. L’égalité vient de la règle des puissances et de la commutativité de la multiplication des exposants, pas d’une coïncidence numérique.

Pour les valeurs de ton support, p vaut vingt-trois et g cinq. Alice choisit six et publie huit ; Bob choisit quinze et publie dix-neuf. Alice calcule dix-neuf puissance six modulo vingt-trois ; Bob calcule huit puissance quinze modulo vingt-trois. Les deux obtiennent deux. On vérifie ces deux calculs séparément dans les exercices et le programme.

Un observateur voit p, g, huit et dix-neuf. Pour de bonnes grandes valeurs, retrouver l’exposant ou la clé doit être difficile selon les hypothèses pertinentes. Mais un attaquant actif peut remplacer les messages d’Alice et de Bob et établir une clé différente avec chacun : c’est une attaque de l’intercepteur. L’échange doit donc être authentifié. Dans un protocole complet, la valeur partagée passe aussi par une dérivation de clé ; on ne l’utilise pas naïvement comme mot de passe ou comme clé brute. Ces précisions complètent le schéma mathématique du support.


### ElGamal : utiliser un secret partagé pour masquer un message

ElGamal réutilise cette idée pour chiffrer un message appartenant au groupe choisi. Alice possède un exposant secret s et publie p, une base a et Q égal a puissance s modulo p. Bob choisit pour ce chiffrement un nouvel exposant aléatoire k. Il calcule C un égal a puissance k, puis masque le message M en le multipliant par Q puissance k modulo p. Il transmet les deux nombres C un et C deux.

Alice connaît s. Elle élève C un à la puissance s et obtient a puissance k fois s. C’est exactement Q puissance k, le masque utilisé par Bob. Elle calcule son inverse modulaire et multiplie C deux par cet inverse. Le masque s’annule et M réapparaît. L’inverse existe parce que le masque est un élément non nul du groupe multiplicatif modulo le premier p. La formule du support utilisant p moins un moins s est une autre écriture, fondée sur Fermat, pour des exposants choisis dans le domaine habituel.

L’exemple du support fixe s égal sept, p égal six cent soixante et un, la base vingt-trois, le message cent quatre-vingt-douze et l’exposant temporaire treize. La bibliothèque et le corrigé donnent les calculs détaillés de Q, C un, du masque et de C deux ; chaque puissance est obtenue avec l’algorithme rapide. Vérifie que le déchiffrement revient à cent quatre-vingt-douze, pas seulement que deux lignes du programme s’exécutent.

Un nouvel aléa k est essentiel pour chaque chiffrement. Réutiliser le même masque permet de relier les messages : le quotient de deux chiffrés peut révéler le quotient des deux messages. Et le schéma ElGamal de base est malléable : modifier le second composant peut modifier le message déchiffré de manière prévisible. On étudie ici la construction algébrique, pas un format de messagerie prêt à déployer.


## RSA, de la génération des clés à l’attaque par diffusion


### Choisir les clés avec le bon modulo

RSA emploie deux premiers distincts p et q. Leur produit n définit l’espace des représentants des messages, de zéro à n moins un. La fonction d’Euler de ce produit vaut p moins un fois q moins un. On choisit ensuite un exposant public e premier avec cette valeur, puis on calcule d, l’inverse de e modulo phi de n. Le couple n, e est public ; d doit rester secret. Connaître p et q permet de recalculer phi et d : ces facteurs doivent également être protégés.

Attention aux deux modulos : le message et ses puissances sont calculés modulo n, mais l’inverse qui produit la clé privée est calculé modulo phi de n. Confondre les deux donne une clé qui ne possède pas la propriété voulue. On choisit aussi p différent de q, sinon la formule de phi employée n’est plus correcte.

Dans l’exemple du cours, p vaut onze et q treize. On obtient n égal cent quarante-trois et phi égal cent vingt. Sept est premier avec cent vingt. Comme cent vingt égale dix-sept fois sept plus un, on peut écrire un égal cent vingt moins dix-sept fois sept. L’inverse de sept est donc moins dix-sept modulo cent vingt, soit cent trois. Vérifions : sept fois cent trois vaut sept cent vingt et un, qui est un plus six fois cent vingt.

Cette identité est le cœur de la construction. Le support p.66 comporte une coquille : c’est le produit e fois d, et non d seul, qui est égal à un plus un multiple de phi de n. Chiffrer élève le message à la puissance e modulo n ; déchiffrer élève le résultat à la puissance d. Une signature RSA est un autre schéma, avec des règles d’encodage et de vérification propres : il ne faut pas présenter cela simplement comme « chiffrer avec la clé privée ».


### Chiffrer, déchiffrer et prouver que cela revient au message

Chiffrons le message trente-cinq avec la clé publique cent quarante-trois, sept. Sept se décompose en un plus deux plus quatre. Le carré de trente-cinq donne le reste quatre-vingt-un modulo cent quarante-trois. Le carré de ce reste, correspondant à la puissance quatre, donne cent vingt-six. On multiplie trente-cinq, quatre-vingt-un et cent vingt-six en réduisant modulo cent quarante-trois : on obtient cent trente-neuf. Le déchiffrement calcule cent trente-neuf puissance cent trois avec l’exponentiation rapide et retrouve trente-cinq.

Pourquoi la construction fonctionne-t-elle ? Si m est premier avec n, Euler donne m puissance phi de n congru à un. Comme e fois d égale un plus k fois phi de n, m puissance e fois d est égal à m multiplié par une puissance de m puissance phi de n. Le second facteur vaut un modulo n ; il reste m.

Mais le message peut être divisible par p ou par q. Il faut alors une preuve qui n’oublie pas ce cas. Raisonnons modulo p. Si p divise m, m et sa puissance positive valent tous deux zéro. Sinon Fermat donne m puissance p moins un congru à un ; l’exposant e fois d moins un étant multiple de p moins un, on retrouve encore m. Le même raisonnement vaut modulo q. Les deux résultats sont donc congrus à m modulo p et modulo q. Puisque p et q sont premiers entre eux, le théorème des restes chinois implique l’égalité modulo leur produit n. Cette preuve couvre aussi m égal zéro.

Pour transformer un texte en entiers, il faut définir l’encodage et la taille des blocs. L’exemple p.67 avec p égal vingt-trois, q égal treize et e égal sept donne n égal deux cent quatre-vingt-dix-neuf, donc chaque octet inférieur à deux cent cinquante-six tient dans l’espace des messages. On encode le texte en UTF-8, on chiffre les octets, on les déchiffre puis on décode les octets retrouvés. Ce choix explicite résout la présence d’accents dans l’énoncé.


### Le même message envoyé sans protection à plusieurs destinataires

L’attaque par diffusion du support montre qu’une primitive mathématique correcte ne suffit pas pour définir un chiffrement sûr. Supposons que le même entier M soit chiffré directement avec l’exposant trois pour trois destinataires. Leurs modulos sont deux à deux premiers entre eux. Un observateur récupère les trois restes de M au cube et connaît les trois modulos publics. Le théorème des restes chinois lui donne la classe de M au cube modulo le produit des trois modulos.

Si M est inférieur à chacun des trois modulos, son cube est strictement inférieur à leur produit. Le représentant retrouvé par les restes chinois est alors exactement le cube de M, et non seulement un nombre congru à ce cube. Une racine cubique entière suffit à retrouver M ; aucune factorisation des modulos n’est nécessaire.

Le cours utilise les modulos quatre-vingt-cinq, cent quarante-trois et cent trente-trois pour M égal soixante-deux. Les chiffrés valent soixante-treize, quatre-vingt-dix et cent vingt-cinq. La reconstruction donne deux cent trente-huit mille trois cent vingt-huit ; c’est exactement soixante-deux au cube. Le produit des modulos vaut un million six cent seize mille six cent quinze, donc le cube se trouve bien sous cette limite.

Le complément pratique important est de distinguer RSA brut et un schéma d’encodage de chiffrement comme RSA-OAEP, décrit dans la RFC huit mille dix-sept. On ne réutilise pas les exercices sur de petits entiers comme bibliothèque de sécurité pour des données réelles. L’exposant public trois n’est pas à présenter comme un choix actuel universel des cartes bancaires : l’attaque enseignée repose sur des hypothèses précises de réutilisation du même message et d’absence d’encodage approprié. Dans notre code, le calcul reste volontairement pédagogique et identifié comme tel.


## Fermat, Carmichael, Miller–Rabin et génération de premiers


### Un test qui échoue prouve quelque chose ; un test réussi pas toujours

Le petit théorème de Fermat donne une propriété nécessaire des nombres premiers. Si un entier n est premier et si la base a est comprise entre un et n moins un, alors a puissance n moins un est congru à un modulo n. Donc, si on trouve une base de cet intervalle qui échoue, n est certainement composé. C’est une application de la contraposée : si la conclusion nécessaire est fausse, l’hypothèse ne peut pas être vraie.

La réciproque n’est pas garantie. Le nombre quatre-vingt-onze est composé, puisqu’il vaut sept fois treize, mais la base trois satisfait la congruence de Fermat. Pour le vérifier, on peut calculer les carrés successifs ou utiliser l’exponentiation rapide : trois puissance quatre est congru à moins dix ; trois puissance huit est congru à neuf ; les puissances permettent finalement de retrouver un pour l’exposant quatre-vingt-dix. On dit que quatre-vingt-onze est pseudopremier pour cette base, pas qu’il est devenu premier.

Un nombre de Carmichael est un composé qui passe la congruence de Fermat pour toute base première avec lui. Cinq cent soixante et un vaut trois fois onze fois dix-sept ; ses facteurs sont distincts et chacun de p moins un divise cinq cent soixante. Il trompe donc toutes les bases copremières. Une base qui partage un facteur avec lui peut néanmoins le détecter. Répéter Fermat n’offre ainsi pas, pour n’importe quel nombre composé, la garantie d’erreur que l’on pourrait imaginer.

Les pourcentages de la p.73 ne doivent pas être repris comme une borne universelle de fiabilité : une probabilité dépend de la manière de choisir le nombre et les bases, et des hypothèses utilisées. Il faut distinguer « ce composé a échappé au test » et « quelle est la probabilité que le nombre tiré soit composé sachant le test réussi ». Ces deux probabilités ne se confondent pas.


### Miller–Rabin inspecte la chaîne de carrés

Miller–Rabin renforce le contrôle. Pour un entier impair n supérieur à trois, on écrit n moins un comme deux puissance s fois d, avec d impair. On obtient cette écriture en divisant n moins un par deux tant que le résultat est pair. Pour quatre-vingt-onze, quatre-vingt-dix égale deux fois quarante-cinq ; s vaut un et d quarante-cinq. Pour dix-sept, seize égale deux puissance quatre fois un.

On choisit une base entre deux et n moins deux et on calcule x égal a puissance d modulo n. Si x vaut un ou moins un modulo n, cette base ne détecte pas de composition. Sinon on élève x au carré jusqu’à s moins un fois et on cherche la valeur moins un. Si elle n’apparaît pas, n est composé. Pourquoi cela examine-t-il quelque chose de plus précis que Fermat ? Dans un corps modulo un premier, les racines de x carré égal un sont seulement un et moins un, car x moins un fois x plus un vaut zéro et le corps n’a pas de diviseurs de zéro. Une chaîne de carrés compatible avec un premier doit respecter cette structure.

Pour un composé impair fixé, au plus un quart des bases du domaine standard peuvent le tromper. Avec t bases choisies uniformément et indépendamment, la probabilité de toutes les manquer est donc au plus quatre puissance moins t. C’est une borne conditionnelle pour un composé fixé et un choix de bases spécifié ; ce n’est pas directement une probabilité a posteriori que le candidat soit premier. Un résultat positif signifie « probablement premier », alors qu’un témoin négatif prouve la composition.

Le code traite zéro, un, deux, trois et les pairs avant de choisir une base, puis effectue cette décomposition et cette boucle. Cette préparation empêche notamment de tirer une base dans un intervalle vide. Le contrôle sera comparé au test exact par divisions sur de petites valeurs et à des composés connus.


### Construire les candidats et les blocs du TP

Pour générer un candidat de exactement k bits, tirer un nombre avec k bits aléatoires ne suffit pas : les premiers bits peuvent être nuls. On force donc le bit de poids fort à un. On force aussi le bit le plus faible à un pour ne tester que des nombres impairs. En Python, le module secrets fournit l’aléa destiné aux usages sensibles ; ce choix est plus approprié que le générateur random pour les secrets. Après de petits tests de divisibilité, on applique le test de primalité retenu et on recommence si le candidat échoue.

Le support demande ensuite un RSA avec des blocs de deux cent cinquante-six bits et un module n strictement supérieur à deux puissance deux cent cinquante-six. Il faut respecter cette inégalité, pas seulement choisir une taille portant le même nom. Par exemple, deux premiers d’exactement cent trente bits ont un produit d’au moins deux puissance deux cent cinquante-huit, donc chaque entier d’un bloc de trente-deux octets tient sous n. Ces petites tailles restent celles d’un exercice, pas un choix de sécurité pour un service réel.

Si e est fixé à sept, certains couples de premiers ne conviennent pas : dès que sept divise phi de n, l’inverse privé n’existe pas. Il faut alors tirer d’autres premiers. On vérifie aussi qu’ils sont distincts. La génération rend ces conditions explicites plutôt que de laisser une erreur apparaître au moment du déchiffrement.

Un texte se convertit d’abord en octets UTF-8, puis en blocs de trente-deux octets, enfin en entiers. Pour revenir, il faut connaître la longueur de chaque bloc, surtout du dernier. Sans cette information, un octet nul placé au début pourrait disparaître pendant la conversion et l’aller-retour ne serait plus fidèle. Le corrigé joint conserve donc les longueurs, teste les accents et les octets nuls, et vérifie l’égalité exacte du message avant et après. La réussite sur un exemple ne remplace pas la vérification des conditions de construction.


## Sac à dos, suites supercroissantes et Merkle–Hellman


### Quand un problème de choix devient facile

Le problème du sac à dos possède plusieurs variantes. Dans la variante d’optimisation, chaque objet a un poids et une valeur ; on cherche une valeur totale maximale sans dépasser une capacité. Dans la variante utilisée ici pour la cryptographie, on cherche exactement une somme cible : chaque objet est soit présent, soit absent. Un bit b égal un signifie présent ; zéro signifie absent. La somme des poids sélectionnés doit être exactement W.

Pour l’exemple d’optimisation p.76, les objets ont les poids treize, douze, huit et dix, et les valeurs sept, quatre, trois et trois ; la capacité vaut trente. Les deux premiers donnent une valeur onze pour un poids vingt-cinq. Les autres combinaisons admissibles ne dépassent pas cette valeur ; le corrigé vérifie les seize sous-ensembles. Pour l’exemple de somme exacte p.77, les poids cinquante-quatre, vingt-sept, soixante et onze, cinquante-six et seize sont associés à la cible cent quarante-neuf. La vérification exhaustive des trente-deux choix possibles ne trouve aucune solution. Cela donne une raison de contrôler un énoncé plutôt que d’inventer une combinaison : un problème de somme exacte peut très bien n’avoir aucune solution.

Une suite est supercroissante quand chaque poids dépasse la somme de tous les précédents. Pour deux, trois, six, douze, trois dépasse deux, six dépasse cinq et douze dépasse onze. En partant du plus grand poids, le choix devient forcé. Si la cible restante vaut au moins ce poids, il faut le prendre, car tous les poids plus petits réunis ne pourraient pas le remplacer. Sinon il ne faut pas le prendre. Pour quinze, on prend douze, on laisse six, on prend trois, on laisse deux : les bits sont zéro, un, zéro, un.

L’algorithme est glouton : il fait un choix local définitif à chaque étape. Ce choix est justifié par l’hypothèse supercroissante. Pour des poids quelconques, un glouton peut échouer même lorsqu’une solution existe. Il faut donc vérifier la propriété avant d’utiliser la recette et vérifier que le reste final vaut zéro.


### Une trappe : retrouver une somme privée facile à décoder

Merkle–Hellman transforme une suite facile à décoder en une suite publique qui ne montre plus directement sa structure supercroissante. La clé privée comprend la suite w, un module N strictement supérieur à la somme des poids et un multiplicateur A premier avec N. On publie pour chaque poids son produit par A réduit modulo N. Pour chiffrer un bloc de bits, on additionne les poids publics sélectionnés, sans réduire nécessairement cette somme publique.

Pour déchiffrer, on multiplie cette somme par l’inverse de A modulo N. On retrouve alors la somme des poids privés sélectionnés modulo N. Pourquoi est-ce une somme exacte, et pas seulement un reste ? Parce que toutes les sommes de poids privés sont inférieures à N, puisque N dépasse leur somme totale. On peut donc appliquer le glouton à la véritable cible privée et retrouver les bits.

Reprenons chaque calcul de la p.80. Pour la suite deux, trois, six, douze, le module quarante-sept et le multiplicateur dix-sept, deux fois dix-sept vaut trente-quatre, trois fois dix-sept vaut cinquante et un donc quatre, six fois dix-sept vaut cent deux donc huit, et douze fois dix-sept vaut deux cent quatre donc seize. Les quatre valeurs publiques sont donc trente-quatre, quatre, huit et seize. L’inverse de dix-sept modulo quarante-sept vaut trente-six : leur produit vaut six cent douze, qui est un plus treize fois quarante-sept.

Pour les bits un, zéro, un, un, la somme publique vaut trente-quatre plus huit plus seize, soit cinquante-huit. Trente-six fois cinquante-huit vaut deux mille quatre-vingt-huit, dont le reste modulo quarante-sept vaut vingt. Le glouton retrouve douze, six et deux, donc les bits initiaux. En revanche, la formulation générale de la p.79 demande des précautions : une congruence de sommes n’est pas automatiquement une égalité de sommes. Et la sécurité ne découle pas du simple fait que le problème général de sac à dos est NP-complet. Le système original de Merkle–Hellman est historiquement cassé ; il sert ici à comprendre une construction à trappe.
