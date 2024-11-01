var title = "糕餅店";
var question = "糕餅店舉辦促銷活動。店內所有禮盒原價皆為200元，每筆訂單運費為80元。本次促銷活動如下：\n\t購買1~5個禮盒，享9折優惠\n\t購買6~10個禮盒，享8折優惠\n\t購買11~15個禮盒，享7折優惠\n\t購買16個禮盒以上，享6折優惠\n\t折扣完滿1200元再享免運優惠\n請設計本次促銷活動計價程式，根據購買禮盒的數量，計算顧客應付金額。";
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
        input: "3",
        output: "620",
        note: "購買3個禮盒，共600元。打9折後為540。需付運費，共620元。"
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