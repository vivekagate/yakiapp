export class Utilities {
    static timeAgo(dateParam: any) {
        if (!dateParam) {
            return null;
        }

        const date = new Date(dateParam);
        const today = new Date();
        const seconds = Math.round((today.getTime() - date.getTime()) / 1000);
        const minutes = Math.round(seconds / 60);

        if (seconds < 5) {
            return 'now';
        } else if (seconds < 60) {
            return `${ seconds } secs`;
        } else if (minutes < 60) {
            return `${ minutes } mins`;
        } else if (minutes < (48*60)) {
            return `${ Math.round(minutes/60) } hours`;
        } else {
            return `${ Math.round(minutes/(24*60)) } days`;
        }
    }
}