<template>
    <v-container class="pa-0">
        <v-data-table
            :headers="specialHeaders" hide-default-footer items-per-page="-1" :items="specialItems"
            class="elevation-1"
        >
            <template #top>
                <v-toolbar border color="navigation-background" rounded="lg">
                    <v-toolbar-title>Special Characters</v-toolbar-title>
                </v-toolbar>
            </template>
        </v-data-table>
    </v-container>
</template>

<script>
export default {
    name: 'CronSpecialCharacters',
    data () {
        return {
            specialHeaders: [
                { title: 'Special Character', value: 'character' },
                { title: 'Description', value: 'description' },
                { title: 'Applicable Fields', value: 'fields' }
            ],
            specialItems: [
                { character: '*', description: 'The asterisk substitutes all possible values for a field. For example, when used in the hour field, it indicates that the task should be executed every hour.', fields: 'All' },
                { character: '-', description: 'The dash is used to define a range of values in a single field. For example, entering 3-5 in the minute field instructs a cron job to run every minute between and including the 3rd and 5th minute.', fields: 'All' },
                { character: '/', description: 'The forward slash is used to specify increments in a field. For example, `*/10` in the minute field means the task runs every 10 minutes.', fields: 'Second, Minute, Hour, Month, Year' },
                { character: '?', description: 'The question mark is used as a placeholder in the Day of the Month and Day of the Week fields when you want to specify one of these fields while leaving the other unspecified.', fields: 'Day of the Month, Day of the Week' },
                { character: 'L', description: 'Represents the last day in the Day of the Month or Day of the Week fields.', fields: 'Day of the Month, Day of the Week' },
                { character: 'W', description: 'Represents the weekday closest to a given day in the Day of the Month field. This character is useful for ensuring tasks only run on weekdays.', fields: 'Day of the Month' },
                { character: '#', description: 'The hashtag is used to specify the nth occurrence of a day of the week in a month. For example, `5#3` in the Day of the Week field runs a cron job on the third Friday of the month.', fields: 'Day of the Week' },
                { character: ',', description: 'The comma allows for specific, non-sequential time points to be defined within the cron schedule. Using `15,45` in the minute field runs the task at 15 and 45 minutes past the hour.', fields: 'All' }
            ]
        }
    }
}
</script>

<style scoped>
.v-data-table {
    width: 100%;
}
</style>
