const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getGraphDataForDay(date) {
	try {
		const startDate = new Date(date);
		const endDate = new Date(date);
		endDate.setDate(endDate.getDate() + 1); // Add 1 day to the end date
	

		const graphData = await prisma.tokenPrice.findMany({
			where: {
				createdAt: {
					gte: startDate,
					lt: endDate,
				},
			},
			select: {
				id: true,
				price: true,
				symbol: true,
				currency: true,
				createdAt: true,
			},
		});

		return graphData;
	} catch (error) {
		console.error('Error retrieving graph data:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Usage example
const date = '2023-10-17T00:00:00Z'; // Replace this with your desired date
getGraphDataForDay(date)
	.then((data) => {
		console.log('Graph data for the specified day:', data);
	})
	.catch((error) => {
		console.error('Error:', error);
	});
