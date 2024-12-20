// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient();

// async function getGraphDataForDay(date) {
// 	try {
// 		const startDate = new Date(date);
// 		const endDate = new Date(date);
// 		endDate.setDate(endDate.getDate() + 1); // Add 1 day to the end date

// 		const graphData = await prisma.tokenPrice.findMany({
// 			where: {
// 				createdAt: {
// 					gte: startDate,
// 					lt: endDate,
// 				},
// 			},
// 			select: {
// 				id: true,
// 				price: true,
// 				symbol: true,
// 				currency: true,
// 				createdAt: true,
// 			},
// 		});

// 		return graphData;
// 	} catch (error) {
// 		console.error('Error retrieving graph data:', error);
// 		throw error;
// 	} finally {
// 		await prisma.$disconnect();
// 	}
// }

// // Usage example
// const date = '2023-10-18T00:00:00Z'; // Replace this with your desired date
// getGraphDataForDay(date)
// 	.then((data) => {
// 		console.log('Graph data for the specified day:', data);
// 	})
// 	.catch((error) => {
// 		console.error('Error:', error);
// 	});

// function formatDate(date) {
// 	const year = date.getFullYear();
// 	const month = String(date.getMonth() + 1).padStart(2, '0');
// 	const day = String(date.getDate()).padStart(2, '0');
// 	return `${year}-${month}-${day}`;
// }

// // Calculate dates
// const oneDayAgo = new Date();
// console.log(oneDayAgo, 'oneDayAgo');
// oneDayAgo.setDate(oneDayAgo.getDate() - 1);

// const oneWeekAgo = new Date();
// console.log(oneWeekAgo, 'oneWeekAgo');

// oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

// const oneMonthAgo = new Date();
// console.log(oneMonthAgo, 'oneMonthAgo');

// oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

// console.log('One day ago:', formatDate(oneDayAgo));
// console.log('One week ago:', formatDate(oneWeekAgo));
// console.log('One month ago:', formatDate(oneMonthAgo));

// Your date string
// const dateString = '2023-10-18T11:57:37.283Z';

// // Convert the date string to a JavaScript Date object
// const date = new Date(dateString);
// console.log(date, 'oooooooooo');
// // Calculate one month ago
// date.setMonth(date.getMonth() - 1);

// // Function to format a date as 'YYYY-MM-DD'
// function formatDate(date) {
// 	const year = date.getUTCFullYear();
// 	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
// 	const day = String(date.getUTCDate()).padStart(2, '0');
// 	return `${year}-${month}-${day}`;
// }

// // Format the resulting date as 'YYYY-MM-DD'
// const startDate = formatDate(date);

// console.log('One month ago:', new Date(startDate));

const date1 = new Date('2023-10-18T00:00:00.000Z');
const date2 = new Date('2023-10-18T12:19:38.946Z');

// Calculate the difference in milliseconds
const timeDifference = date2 - date1;

// Create a new date by adding the time difference (1 hour) to date1
const date1Plus1Hour = new Date(date1.getTime() + 60 * 60 * 1000);

console.log('Original Date 1:', date1.toISOString());
console.log('Original Date 2:', date2.toISOString());
console.log('Date 1 plus 1 hour:', date1Plus1Hour.toISOString());
