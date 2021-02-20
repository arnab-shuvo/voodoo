const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize');

var unifiedCrawler = require('appstore-playstore-crawler-api');

const db = require('./models');
const game = require('./models/game');

const app = express();

app.use(bodyParser.json());
app.use(express.static(`${__dirname}/static`));

app.get('/api/games', (req, res) =>
	db.Game.findAll()
		.then((games) => res.send(games))
		.catch((err) => {
			console.log('There was an error querying games', JSON.stringify(err));
			return res.send(err);
		}),
);

app.post('/api/games', (req, res) => {
	const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
	return db.Game.create({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
		.then((game) => res.send(game))
		.catch((err) => {
			console.log('***There was an error creating a game', JSON.stringify(err));
			return res.status(400).send(err);
		});
});

app.delete('/api/games/:id', (req, res) => {
	// eslint-disable-next-line radix
	const id = parseInt(req.params.id);
	return db.Game.findByPk(id)
		.then((game) => game.destroy({ force: true }))
		.then(() => res.send({ id }))
		.catch((err) => {
			console.log('***Error deleting game', JSON.stringify(err));
			res.status(400).send(err);
		});
});

app.put('/api/games/:id', (req, res) => {
	// eslint-disable-next-line radix
	const id = parseInt(req.params.id);
	return db.Game.findByPk(id).then((game) => {
		const { publisherId, name, platform, storeId, bundleId, appVersion, isPublished } = req.body;
		return game
			.update({ publisherId, name, platform, storeId, bundleId, appVersion, isPublished })
			.then(() => res.send(game))
			.catch((err) => {
				console.log('***Error updating game', JSON.stringify(err));
				res.status(400).send(err);
			});
	});
});

app.post('/api/games/search', (req, res) => {
	const { name, platform } = req.body;
	return db.Game.findAll({
		where: {
			name: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('name')), 'LIKE', `%${name}%`),

			platform: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('platform')), 'LIKE', `%${platform}%`),
		},
	})
		.then((games) => {
			if (game.length) {
				res.send({ games });
			} else {
				db.Game.findAll()
					.then((games) => res.send(games))
					.catch((err) => {
						console.log('There was an error querying games', JSON.stringify(err));
						return res.send(err);
					});
			}
		})
		.catch((err) => {
			console.log('***Error deleting game', JSON.stringify(err));
			res.status(400).send(err);
		});
});

app.post('/api/games/populate', (req, res) => {
	const games = [];
	const promise1 = unifiedCrawler.apple.getSearchResult('', 100).then((result) => {
		result.forEach((app) => {
			const appdata = {
				publisherId: app.developerId,
				name: app.title,
				platform: 'ios',
				storeId: app.id,
				bundleId: app.primaryGenreId,
				appVersion: app.requiredOsVersion,
				isPublished: true,
			};
			games.push(appdata);
		});
	});
	const promise2 = unifiedCrawler.google.getSearchResult('', 100).then((result) => {
		result.forEach((app) => {
			const appdata = {
				publisherId: app.developerId,
				name: app.title,
				platform: 'android',
				storeId: app.id,
				bundleId: app.primaryGenreId,
				appVersion: app.requiredOsVersion,
				isPublished: true,
			};
			games.push(appdata);
		});
	});
	Promise.all([promise1, promise2]).then(() => {
		res.send(db.Game.bulkCreate(games));
	});
});

app.listen(3000, () => {
	console.log('Server is up on port 3000');
});

module.exports = app;
