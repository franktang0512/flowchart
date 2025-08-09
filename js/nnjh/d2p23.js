var title = "雞排飲料店";
var question = "雞排飲料店販賣雞排與珍珠奶茶，每個盒子最多可以裝5塊雞排，每個紙架最多能放4杯珍珠奶茶。\n給定每日訂單的數量與資訊，且每筆訂單會分開裝袋，計算該日使用盒子與紙架的總數量。\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "4<br>10 15<br>33 30<br>50 25<br>100 100	39",
        output: "44",
        note: "本日有4筆訂單，第一筆訂單訂購10塊雞排、15杯珍珠奶茶，需要2個紙盒與4個紙架，依此類推。共需2+7+10+20，共39個紙盒，以及4+8+7+25，共44個紙架。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})