# Salt & Steel

**Salt & Steel** est un jeu web multijoueur & solo développé en équipe dans le cadre du programme de génie logiciel de Polytechnique Montréal.

Les joueurs peuvent créer leurs propres cartes et affronter d'autres joueurs lors de combats en temps réel, sur des cartes préconçues ou créées par la communauté.

## 🎮 Fonctionnalités

* Combats multijoueurs
* Interactions entre les joueurs en temps réel
* Création de cartes personnalisées
* Combats sur des cartes préconçues
* Combats sur des cartes créées par les joueurs
* Parties & combats contre des joueurs virutels

## 🛠️ Technologies

* **Frontend :** Angular, TypeScript
* **Backend :** NestJS, Node.js
* **Communication en temps réel :** Socket.IO
* **Tests :** Jest
* **Qualité du code :** ESLint
* **Base de donée :** MongoDB

## 👥 Projet d'équipe

Salt & Steel a été développé en collaboration par une équipe de 6 étudiants en génie logiciel dans le cadre du cours LOG2995.

Le projet a nécessité une collaboration étroite entre les membres de l'équipe, notamment à travers le développement collaboratif en agile, les revues de code, la gestion des versions, les tests et l'intégration de plusieurs composants frontend et backend.

## 👤 Mon rôle

**Développeur**

J'ai participé à la conception et au développement de l'application en collaboration avec les autres membres de l'équipe.

### Mes contributions

* [Fonctionnalité que tu as développée]
* [Fonctionnalité que tu as développée]
* [Fonctionnalité que tu as développée]
* [Autre contribution importante]

## 📸 Captures d'écran

*Ajouter des captures d'écran ou des GIFs présentant le jeu et ses principales fonctionnalités.*

## 🚀 Lancer le projet

### Prérequis

* Node.js
* npm

### Installation

Cloner le repository et installer les dépendances du client et du serveur :

```bash
cd client
npm ci

cd ../server-nestjs
npm ci
```

### Développement

Lancer le client :

```bash
cd client
npm start
```

## Déploiement sur Render

Le fichier `render.yaml` à la racine décrit un service web Render unique. Le serveur NestJS sert le client Angular compilé, l'API sous `/api` et les connexions Socket.IO sur la même origine HTTPS.

1. Créez un cluster MongoDB Atlas et autorisez les connexions depuis Render (`0.0.0.0/0` dans Atlas, avec un utilisateur et un mot de passe robustes).
2. Dans Render, choisissez **New > Blueprint** et connectez ce dépôt.
3. À la création du Blueprint, renseignez `DATABASE_CONNECTION_STRING` avec l'URI MongoDB complète, par exemple `mongodb+srv://UTILISATEUR:MOT_DE_PASSE@cluster.example.mongodb.net/salt-and-steel?retryWrites=true&w=majority`.
4. Lancez le déploiement. Render fournit ensuite une URL HTTPS en `onrender.com`.

Ne placez jamais l'URI MongoDB réelle dans Git. Le plan gratuit peut mettre le serveur en veille après une période d'inactivité; la première requête suivante peut donc être plus lente.

Lancer le serveur :

```bash
cd server-nestjs
npm start
```

Le client et le serveur seront ensuite accessibles localement selon leur configuration respective.

## 📚 Documentation du projet

La documentation supplémentaire est disponible dans le repository :

* [Guide de contribution](CONTRIBUTING.md)
* [Guide de déploiement](DEPLOYMENT.md)
* [Documentation des tests](TESTS.md)

## 🎓 Contexte académique

Ce projet a été développé dans le cadre du cours **LOG2995 – Projet de génie logiciel** à Polytechnique Montréal.

Le projet nous a permis de mettre en pratique plusieurs concepts du génie logiciel dans un environnement collaboratif, notamment la gestion de versions, les revues de code, les tests automatisés, l'intégration continue et les méthodes de développement Agile.

