"use server";

import fs from "fs";
import path from "path";
import { parse } from "papaparse";

export interface Guest {
  name: string;
  email: string;
  phone: string;
  last_visit: string;
  favorite_item: string;
  visit_count: string;
}

export async function getSlippingRegulars() {
  const filePath = path.join(process.cwd(), "src/data/mock-guests.csv");
  const csvFile = fs.readFileSync(filePath, "utf8");
  
  const results = parse<Guest>(csvFile, {
    header: true,
    skipEmptyLines: true,
  });

  const guests = results.data;
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

  const slipping = guests.filter((guest) => {
    const lastVisit = new Date(guest.last_visit);
    return lastVisit < fortyFiveDaysAgo && parseInt(guest.visit_count) > 5;
  });

  return slipping;
}

export async function draftSMS(guest: Guest) {
  return `Hi ${guest.name.split(" ")[0]}! We've missed you at EasyReview. We're craving your favorite ${guest.favorite_item} and would love to see you soon. Use code WELCOMEBACK for a complimentary appetizer this weekend!`;
}
