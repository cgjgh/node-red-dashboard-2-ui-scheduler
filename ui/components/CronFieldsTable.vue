<template>
    <v-container class="pa-0">
        <v-data-table
            :headers="cronHeaders" hide-default-footer items-per-page="-1" :items="cronItems"
            class="elevation-1"
        >
            <template #top>
                <v-toolbar border color="navigation-background" rounded="lg">
                    <v-toolbar-title>Cron Fields</v-toolbar-title>
                </v-toolbar>
            </template>
        </v-data-table>
        <v-divider class="my-4" />
        <p>
            A cron expression is defined by between 5 and 7 fields
            separated by whitespace, as detailed above.
        </p>
        <br>
        <p>
            Each field can contain an integer value in the allowed
            values range for that field, a three letter abbreviation
            (case insensitive) for the Day of Week and Month fields,
            or an expression containing a symbol.
        </p>
        <br>
        <p>
            For the <code>Day of Week</code> field, 0 and 7 are equivalent to <code>Sun</code>, 1 = <code>Mon</code>,
            ... , 5 = <code>Fri</code>, 6 = <code>Sat</code>.
        </p>
        <br>
        <p>
            <b>Note:</b> If only 5 fields are given, both the optional second and year fields will be given their
            default values of <code>0</code> and <code>*</code> respectively. If 6 fields are given, the first field is
            assumed to be the second field, and the year field given its default value.
        </p>
    </v-container>
</template>

<script>
export default {
    name: 'CronFieldsTable',
    data () {
        return {
            cronHeaders: [
                { title: '#', value: 'number' },
                { title: 'Field Name', value: 'field' },
                { title: 'Allowed Values', value: 'allowed' },
                { title: 'Special Chars', value: 'special' }
            ],
            cronItems: [
                { number: 1, field: 'Second (optional)', allowed: '0-59', special: '* / , -' },
                { number: 2, field: 'Minute', allowed: '0-59', special: '* / , -' },
                { number: 3, field: 'Hour', allowed: '0-23', special: '* / , -' },
                { number: 4, field: 'Day of Month', allowed: '1-31', special: '* / , - ? L W' },
                { number: 5, field: 'Month', allowed: '1-12 or JAN-DEC', special: '* / , -' },
                { number: 6, field: 'Day of Week', allowed: '0-7 or SUN-SAT', special: '* / , - ? L #' },
                { number: 7, field: 'Year (optional)', allowed: '0-275759', special: '* / , -' }
            ]
        }
    }
}
</script>

<style scoped>
.v-data-table {
    width: 100%;
}

.v-divider {
    margin-top: 16px;
    margin-bottom: 16px;
}
</style>
